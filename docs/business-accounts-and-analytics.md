# Business Accounts & Analytics — Product Notes

Internal notes for the backend developer, covering product discussion from
2026-08-20: interaction analytics on the business dashboard (§2, not yet
built), the business onboarding/auth redesign (§3, **now implemented** in
the web app), search autosuggest (§4, partially built already, two gaps
remain), notification trigger logic (§5, UI built, no real data behind it
yet), and the business dashboard's catalog/media/account tooling (§6, **now
implemented**).

---

## 1. Current state (verified in code, as of this writing)

**Analytics**
- `BizHomeTab` ([webapp/src/components/BusinessDashboard.jsx:265-284](../webapp/src/components/BusinessDashboard.jsx#L265-L284)) already renders stat tiles for **Visits, Calls, Searches, Bookmarks** — all showing a static "Coming soon" placeholder. No wiring to real data yet.
- User interactions (`call`, `bookmark`, `direction`, `rate`) are recorded only in the browser's `localStorage`, per device, via [webapp/src/recentInteractions.js](../webapp/src/recentInteractions.js). Nothing is written to Firestore. There is currently no data source for the dashboard to read from.

**Business accounts** — *updated 2026-08-20, §3 is now implemented*
- There is now a single entry point: the Sidebar's **"Become a Business"** button ([Sidebar.jsx:121-128](../webapp/src/components/Sidebar.jsx#L121-L128)) → `handleOpenBusiness` ([main.jsx:1493](../webapp/src/main.jsx#L1493)). The old admin-only floating "Add Mechanic" button — hardcoded to three admin emails, and a backdoor around auth entirely — has been removed. Admins now go through the same flow as anyone else.
- `AuthModal` ([main.jsx:258](../webapp/src/main.jsx#L258)) shows an **email + password form** for `reason === 'business'` instead of Google. One submit (`submitBusinessAuth`) covers both directions: it tries `signInWithEmailAndPassword` first, and falls back to `createUserWithEmailAndPassword` if that fails — so an existing account signs in and a brand-new email creates one, with no separate log-in/sign-up toggle to get wrong. Google sign-in is untouched for the consumer bookmark/rate flows.
- On success, the `AuthModal` render site (main.jsx, the `modal === 'auth'` block) checks whether the signed-in account already owns a mechanic doc (`createdBy === user.uid`). If it does, onboarding is skipped and the Business Dashboard opens directly; if not, the onboarding wizard (`MechanicModal`) opens.
- Business "ownership" still falls back to a random `local-owner-<timestamp>` id in `localStorage` ([main.jsx:1033](../webapp/src/main.jsx#L1033)), but now only when Firebase itself isn't configured (no `.env`) — the same local-dev fallback the rest of the app already uses, not a bypass around real accounts.
- Self-submitted listings still save `claimed: true`, mapping to verification **tier 2 ("Claimed")** in `getVerificationTier` ([webapp/src/components/MechanicListPanel.jsx:173](../webapp/src/components/MechanicListPanel.jsx#L173)). Curated/admin listings carry `verified: true` (tier 1).

In short: the business auth/entry-point redesign in §3 is now implemented. The dashboard analytics tiles (§2) and the search gaps (§4) are still open.

---

## 2. Analytics: what to build

Mirror the pattern already used for ratings (`rating` / `ratingCount` / `ratingSum` on the mechanic doc, publicly writable but field-restricted — see [firestore.rules:22-26](../firestore.rules#L22-L26)):

- Add counter fields to the `mechanics/{id}` doc: `visitCount`, `callCount`, `bookmarkCount`, `searchCount` (naming TBD to match the four dashboard tiles).
- Increment them atomically (`increment()`) at the same call sites that already fire `recordInteraction()` today (`onRecordInteraction` calls in [main.jsx](../webapp/src/main.jsx) and [MechanicListPanel.jsx](../webapp/src/components/MechanicListPanel.jsx)).
- Dashboard reads the counters straight off the mechanic doc — no extra queries.

**Tradeoff:** this gives running totals only, not trends over time. If "calls this week" style charts are wanted later, that needs an event subcollection (`mechanics/{id}/interactions/{autoId}`) instead — more writes/reads, but supports time-series. Recommend shipping the counter version first.

**Security note:** calls and directions currently work without sign-in, so whatever write rule allows anonymous counter increments needs to be scoped tightly (field-restricted, no arbitrary field writes) to limit abuse — same class of risk the existing rating rule already accepts.

---

## 3. Business accounts: redesign

### 3.1 Two intake paths, one entry point — ✅ implemented
The Sidebar's **"Become a Business"** button is now the only way into the business flow, for admins and businesses alike:
- **Admin-added:** you or your co-developer sign in with a dummy email/password and create the listing on the business's behalf (this is the pitch/sales use case — see §3.3).
- **Self-onboarded:** the business owner signs up with their own email/password and fills in their own listing directly.

Both paths land in the exact same onboarding wizard (`MechanicModal` — see §3.5 for its fields).

### 3.2 Business auth is email/password — ✅ implemented
`AuthModal`'s business form (`submitBusinessAuth`, main.jsx) tries `signInWithEmailAndPassword` first; if that fails for any reason, it falls back to `createUserWithEmailAndPassword`. That single try/fallback is what makes one form work as both login and signup — an existing dummy/business account signs in with its real password, a brand-new email creates an account. This is deliberately more robust than checking email existence up front (e.g. via `fetchSignInMethodsForEmail`): modern Firebase projects can have email-enumeration protection enabled, which makes that lookup return an empty result even for real accounts, so a sign-in-then-create attempt is the reliable way to get the same behavior.

**Decided:** this only replaces Google for the business flow. Consumer bookmark/rate sign-in is untouched.

### 3.3 Pitch workflow using admin-created "dummy" accounts — not yet implemented
1. Admin creates a placeholder Firebase Auth account (dummy email + password) and builds out the listing under it — something concrete to show during the pitch, before the business has agreed to anything.
2. If the business is interested, admin approves the listing so it goes live / starts operating on the app.
3. Admin then rotates the account's email and password to the business's real details (requires the Firebase **Admin SDK**, since a client can't change another account's email) and sends the new credentials to the business so they can log in themselves going forward.

*Open question: what does "approve" actually flip? Likely a `status` field (`pending` / `live`) on the mechanic doc, since `verified`/`claimed` already exist for a different purpose (curation tier, not operational status). Needs a decision on who can flip it — Firebase console access only, or an in-app admin role.*

### 3.4 Sign-in branching logic — ✅ implemented
On successful sign-in, the `AuthModal` render site checks whether the authenticated account already owns a mechanic doc (`allMechanics.find(m => m.createdBy === user.uid)`):
- **Match found** → treat as a returning business account, skip onboarding, and open the Business Dashboard directly.
- **No match** → open the onboarding wizard (`MechanicModal`). In practice this path will mostly be admin/co-developer driving onboarding on the business's behalf (per §3.3), with credentials kept on file to hand off afterward.

### 3.5 Business onboarding fields — reference, unchanged by this work
"Become a Business" leads into the same wizard (`MechanicModal`, main.jsx:546-995) that already existed — only the door into it changed. What it collects:

| Field | Notes |
|---|---|
| `businessType` | mechanic / fuel / detailer / shop, from `BUSINESS_TYPES` — picked first, drives the rest of the wizard |
| `name` | garage/business name |
| `area` | landmark / location detail text, reverse-geocoded from the map pin |
| `lat`, `lng` | pin dropped on a Leaflet map; Nominatim (OSM) powers location search and reverse-geocoding, default centered on Accra |
| `phone` | phone number |
| `openingDays`, `operatingTime` | hours of operation |
| `selectedSpecialties` | chosen from the specialty list for the picked `businessType` |
| `about` | free-text description |

New listings are saved with `claimed: true` (tier 2) and `rating: 'New'` until reviewed — see `submitMechanic` (main.jsx:1425).

---

## 4. Search: autosuggest & keyword suggestions

**Current state**
- Autosuggest in `SearchPanel.jsx` ([`suggestions` memo](../webapp/src/components/SearchPanel.jsx#L57-L74)) already builds matches live from the real `mechanics` array — nothing hardcoded. It matches against business name, area, specialty, `specialties[]`, `locationDetail`, `services[]`, and `fuelPrices[].type`.
- The pre-query "popular searches" rows ([`popularSuggestions`](../webapp/src/components/SearchPanel.jsx#L78-L105)) also pull from real data: top-rated business names, areas, and specialty categories.
- Because matching is a plain substring check against real records, area-scoping already falls out for free — typing "Kumasi" only ever surfaces Kumasi-area matches, same for Accra, with no extra logic needed.
- The only static/hardcoded dataset in the app, `mockExtras.json`, is used solely as a local-dev fallback when Firebase isn't configured ([main.jsx:1215-1224](../webapp/src/main.jsx#L1215-L1224)) — it never mixes into a live/production suggestion pool.

**Gaps to close**
- **Products aren't a suggestion source.** The matcher covers `services[]` but not `products[]`, so a business's product catalog never surfaces while typing. Add the same `uniqueMatches.set(...)` pattern used for services.
- **The underlying business list is a one-time snapshot, capped at 100.** `allMechanics` loads once via a single `getDocs(query(collection(db, 'mechanics'), limit(100)))` on app start ([main.jsx:1251](../webapp/src/main.jsx#L1251)) and never refetches. A business added or edited after that load — or any business past the 100th doc — won't appear in suggestions, listings, or search until the page is hard-refreshed. This is the concrete fix behind "restrict to what we currently have on the platform, refreshed periodically": swap the one-shot fetch for a periodic refetch (e.g. every few minutes, or on tab focus/app resume) and raise or paginate past the 100-doc cap.

**Recommendation:** a periodic refetch over a live `onSnapshot` listener, at least to start — keeps read costs predictable and is a much smaller change than converting the whole `allMechanics` pipeline to real-time. Revisit `onSnapshot` if staleness on the order of minutes turns out to matter somewhere else.

---

## 5. Notifications: trigger logic

**Current state**
- `NotificationsPanel.jsx` is a fully-built UI — grouping by day, an unread filter, per-type icons/colors — sitting entirely on top of a hardcoded `MOCK_NOTIFICATIONS` array ([NotificationsPanel.jsx:15-23](../webapp/src/components/NotificationsPanel.jsx#L15-L23)). The file's own comment says it outright: *"in production this would come from Firestore."* Nothing writes a real notification anywhere today.
- The mock data already models most of what was asked for: a `nearby` type (*"3 new detailers near you"*), a `price` type (*"Price drop on something you saved"*), a `verify` type, etc. — the UI's type system already anticipates this, it just needs a real writer behind it.
- There is no persisted per-user location anywhere in Firestore. `userLocation` ([main.jsx:1091](../webapp/src/main.jsx#L1091)) is `navigator.geolocation` state that lives only in the browser tab — it's never saved to a user's Firestore doc. This matters below.

**What was asked for, translated into triggers:**
1. **New business onboarded** (mechanic, fuel station, auto shop, or detailer) → notify users near that business's location. This is the existing `nearby` notification type — it just needs a real writer instead of mock data.
2. **New product or service added** to an existing business's catalog → notify relevant users. No existing mock type matches this one exactly (`price` is closest, but that's for price *changes*, not new items) — this needs a new notification type, e.g. `new-listing`.
3. **General proximity** ("any mechanic or business around their location") — the same `nearby` mechanism as #1, but not necessarily tied to onboarding — could also run as a periodic/on-demand pass rather than only firing on creation.
4. **In-app delivery** — already the case; `NotificationsPanel` is in-app only. Push notifications (to the device, outside the app) are a separate, much larger piece of work (FCM registration, service worker, permission prompts) that hasn't been discussed or built at all — worth an explicit decision on whether that's in scope now or later.

**Recommended shape:** Firestore-triggered Cloud Functions, not client-side logic — a client can't reliably fan notifications out to *other* users' accounts anyway (see `firestore.rules`, where a user can only write their own docs).
- `onCreate` on `mechanics/{id}` → trigger #1.
- `onCreate` on `mechanics/{id}/products/{id}` or `mechanics/{id}/services/{id}` → trigger #2.
- Each trigger needs a way to find "nearby users" to fan out to. That's the real blocker: there's no persisted user location to query against yet. Options once that's decided: store a coarse last-known location per user (`users/{uid}.location`) updated periodically from the client, or scope "nearby" to a saved home area/city instead of live GPS.
- Fan-out writes land in a `users/{uid}/notifications` subcollection (or similar), which `NotificationsPanel` reads instead of `MOCK_NOTIFICATIONS`.

**Open questions specific to this:**
- Do we persist user location at all, and if so how — live GPS synced periodically, or a chosen "home area" (closer to how `searchedArea` already works elsewhere in the app)? This decides whether triggers #1/#3 are buildable as described.
- Radius/threshold for "nearby"?
- For new product/service (#2): notify nearby users, users who bookmarked that business, or both?
- Is push (FCM) in scope now, or is in-app-only the v1?
- Any rate limiting, so a business adding 10 products in a row doesn't send 10 separate notifications?

---

## 6. Business dashboard: catalog, media, account tooling — ✅ implemented

Everything in this section shipped in the web app on 2026-08-20, after §3. All frontend — no backend/Firestore rule changes needed except where flagged.

### 6.1 Multi-business account switcher
`main.jsx` now **filters** (`allMechanics.filter(m => m.createdBy === businessOwnerId)`) instead of `.find()`-ing a single business. A `<BusinessDashboard>` menu item lists every business the signed-in account owns and switches which one is being managed (`activeBusinessId` state, `onSwitchBusiness` prop). As with the rest of §3, the backend piece — one login legitimately owning several businesses — doesn't exist yet; this only builds the switcher UI on top of whatever `createdBy` matching already returns.

### 6.2 Map tab reuses the real location picker
The dashboard's Map tab previously showed a read-only default Leaflet pin on raw OpenStreetMap tiles — a different, worse-looking map than the rest of the app. `LocationPicker` and the CARTO tile constants (`TILE_URL`/`TILE_SUBDOMAINS`/`TILE_ATTRIBUTION`) were moved out of `main.jsx` into `components/MapLayout.jsx` and exported, so the onboarding wizard and the dashboard's Map tab now share the literal same component. Practical effect: the Map tab's pin is now the same draggable, custom category marker used everywhere else, and **dragging it now actually updates the business's location** — `main.jsx`'s new `handleUpdateBusinessLocation(mechanicId, lat, lng)` writes through to Firestore (`updateDoc`) and patches local state so the pin doesn't snap back.

### 6.3 Desktop layout for the business dashboard
`BusinessDashboard.jsx` was mobile-only (fixed, full-viewport, bottom tab bar) with no responsive treatment at all. Added a `@media (min-width: 960px)` layout — sidebar (brand mark, the account switcher from §6.1, vertical nav) + topbar (breadcrumb, a decorative search field with a ⌘K hint, decorative history/notification/apps icons — chrome present but not wired, same pattern as the existing QR button and "Coming soon" stat tiles) + a time-of-day greeting on the Home tab. Same DOM, same data, same tab components as mobile — CSS reflows it, nothing is duplicated. One thing worth knowing if this area gets touched again: the desktop override rules had to be written as `.biz-dashboard .biz-header`/`.biz-dashboard .biz-bottom-bar`/`.biz-dashboard .biz-content` (not just `.biz-header` etc.) because the base mobile rules sit later in `styles.css` and would otherwise win the cascade at equal specificity regardless of the media query.

### 6.4 Add Product/Service: preview before publish
The add-item form gained `Description` and `Photos` (image URL) fields alongside `Name`/`Price`. Submitting no longer saves immediately — it opens a "Details Page / Listing Page" preview (`previewing` state in `BizCatalogTab`) that reuses the real `.item-sheet-*` and `.service-card-*` styles customers actually see, so the preview can't drift from what ships. A black "Publish" bar performs the actual `addDoc` write. **New fields on `products`/`services` docs:** `description` (string, may be empty) and `imageUrl` (only written when a URL was entered — omitted rather than stored as `undefined`, since Firestore rejects `undefined` field values).

### 6.5 Media tab: categories and captions
Added filter pills (All / General / Products / Services) and a caption per photo. **New fields on `media` docs:** `category` (`'general' | 'products' | 'services'`, defaults to `'general'` client-side when absent so pre-existing photos don't disappear from every filter but "All") and `label` (optional caption string, only written when non-empty). Grid changed from 3 columns to 2 to leave room for the caption.

### 6.6 Universal detailer icon
The app had two different "detailer" icons: a sponge/spray-bottle glyph (`components/icons/CarDetailingIcon.jsx`, used by the Sidebar nav, search suggestions, and the business dashboard) and a colorful car-wash icon (`BizTypeDetailerIcon` in `main.jsx`, used only by the onboarding wizard's type picker). They're now the same icon — `CarDetailingIcon.jsx` was updated to the colorful version, and the wizard now imports it instead of keeping its own copy. The map-pin glyph (`CATEGORY_GLYPH.detailer` in `MapLayout.jsx`) was deliberately left alone — it's a white silhouette on a colored circle, a convention shared by all four category markers, and swapping in a full-color icon for just one of them would break that consistency rather than serve it.

### 6.7 Detailer service/package photos: real placeholders
Four real detailing photos were added at `webapp/public/share-media-attachments/detailer - 1.jpg` through `- 4.jpg`. When a detailer business's service or package has no `imageUrl` of its own, `MechanicDetailPanel.jsx` now shows one of these (deterministically chosen per item name — `getDetailerPlaceholderImage()`, same hash-and-pick pattern as the share-card image assignment in `utils/share.js`) instead of a flat generated color block. Scoped to `specialty === 'Car Detailing'` only — every other business type keeps the flat-color fallback, since there's no equivalent generic photo set for them.

One thing this surfaced worth knowing: detailer businesses' catalog tab is labeled **"Packages"**, not "Services" (`MechanicDetailPanel.jsx:168-172` hardcodes this by category) — they're a different Firestore subcollection (`packages`) from `services`. The Packages tab was switched from a plain text list to the same card layout services use (`layout="cards"`) specifically so this placeholder-photo treatment would actually be reachable; a `duration` line was added to the card body so that field (packages have it, services don't) doesn't disappear in the switch.

---

## 7. Implementation touchpoints

| Location | What's there now |
|---|---|
| `main.jsx` — `AuthModal` | ✅ Email/password for `reason: 'business'` (`submitBusinessAuth`) — tries sign-in, falls back to create. Google unchanged for other reasons. |
| `main.jsx` — the `modal === 'auth'` render site | ✅ On success, checks `allMechanics` for an existing doc owned by the signed-in `uid` and routes to dashboard vs. onboarding accordingly. |
| `main.jsx` — floating admin "Add Mechanic" button | ✅ Removed, along with its hardcoded 3-email allowlist. `Business` submissions only reach `MechanicModal` via "Become a Business" now. |
| `main.jsx` — `handleOpenBusiness` | Unchanged: routes to the dashboard if the current owner already has a business, else opens the auth modal. |
| `main.jsx` — `localBusinessOwnerId` | Unchanged code, changed role: now only used when Firebase isn't configured at all, not as a routine bypass. |
| `main.jsx` — `submitMechanic` | Unchanged; `useLocalBusiness` branch is now effectively a local-dev-only fallback rather than the default business-flow path. |
| `main.jsx:1251` — mechanics load | Still a one-time `getDocs(..., limit(100))` on app start; needs periodic refetch + higher/paginated limit (see §4). |
| `components/SearchPanel.jsx:57-74` — `suggestions` | Still needs `products[]` added as a matched field alongside `services[]` (see §4). |
| `firestore.rules` — `mechanics` collection | Will need a rule branch for a `status`/approval field once one exists (see §3.3). |
| `SETUP.md` | Confirms Email/Password sign-in is enabled on the Firebase project — now actually in use. |
| `components/NotificationsPanel.jsx` | UI is fully built; reads from a hardcoded `MOCK_NOTIFICATIONS` array. Needs a real `users/{uid}/notifications` source and Cloud Function triggers (see §5). |
| `components/MapLayout.jsx` — `LocationPicker`, `TILE_URL`/`TILE_SUBDOMAINS`/`TILE_ATTRIBUTION` | ✅ Moved here from `main.jsx` and exported; shared by the wizard and the dashboard Map tab (§6.2). |
| `main.jsx` — `handleUpdateBusinessLocation` | ✅ New. Writes dragged pin coordinates to Firestore and patches local state (§6.2). |
| `components/BusinessDashboard.jsx` — `BizCatalogTab` | ✅ Add form gained `description`/`imageUrl`; save-on-submit replaced with preview-then-publish (§6.4). |
| `components/BusinessDashboard.jsx` — `BizMediaTab` | ✅ Added `category`/`label` fields and filter pills (§6.5). |
| `components/icons/CarDetailingIcon.jsx` | ✅ Repointed to the colorful icon previously only in the wizard; `main.jsx`'s duplicate copy removed (§6.6). |
| `components/MechanicDetailPanel.jsx` — `getDetailerPlaceholderImage` | ✅ New. Falls back to a real photo for detailer services/packages with no image of their own (§6.7). |

---

## 8. Open questions to settle before backend build starts

- What field represents "approved / live"? New `status` field, or reuse `verified`/`claimed` differently?
- Who can flip approval — admin via Firebase console only, or does this need an in-app admin surface?
- Is a mechanic doc created immediately when the admin makes the dummy account (visible in a "pending" state), or only once approved?
- When credentials are rotated to the business's real email, is the old dummy email discarded or reused for the next pitch?
- Does a self-onboarded business go live immediately, or also sit in "pending" for admin review, same as an admin-added one?
- How often should the periodic mechanics refresh run — every few minutes, on tab focus/app resume, or something else?
- Should the 100-doc `limit()` become real pagination now, or just be raised until the business count makes that necessary?
- Do we persist user location for "nearby" notifications, and as what — live GPS or a chosen home area?
- Is push (FCM) in scope for notifications now, or is in-app-only the v1?
- Should new-product/service notifications target bookmarkers, nearby users, or both?
- Photo uploads everywhere (catalog items, media, business logo) are still plain image-URL text fields — is real file upload (Firebase Storage) in scope soon, or is URL-paste the accepted v1 for businesses without their own image hosting?
- Should the "Packages" vs. "Services" split for detailer businesses stay as-is, or does the product want to unify the label (and the underlying subcollection) across business types at some point?
