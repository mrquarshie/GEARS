// og:image (below) is for MechanicDetailPanel's client-side <Helmet> tags
// only — those never reach a real link-preview crawler (see getShareUrl's
// comment), but still matter for a browser tab/PDF-save/etc. actually
// rendering the page, so this stays as a sane default for that case.
const STATIC_OG_IMAGE = '/share-media-attachments/Mechanic.png';

export function getStaticShareImagePath(mechanic) {
  return mechanic?.shareImage || STATIC_OG_IMAGE;
}

// Routes through /share/:id (-> api/share/[id].js) instead of straight to
// the app's own ?mechanic=<id> URL. That function detects link-preview
// crawlers (WhatsApp, Twitter/X, Facebook, iMessage, etc. — none of which
// execute JS) and serves them real per-business og:title/description/image
// tags server-side; a real visitor gets redirected into the app immediately.
// Client-side <Helmet> tags alone can't do this — crawlers only ever see
// the raw HTML response, never whatever React sets after the fact.
export function getShareUrl(mechanic) {
  return `${window.location.origin}/share/${encodeURIComponent(mechanic.id)}`;
}

// Opens the OS share sheet with just the business link and a short text
// blurb — no attached image. Sharing a file alongside the link makes
// WhatsApp/iMessage/etc. treat the post as a media share and skip fetching
// the URL's own link preview (the per-business og:image from /share/:id),
// so recipients saw our generic card image instead of the real preview.
// Falls back to copying the link when Web Share isn't available (desktop).
export async function shareMechanic(mechanic, { onNotice } = {}) {
  const url = getShareUrl(mechanic);
  const title = mechanic.name;
  const text = `Check out ${mechanic.name} on GEARS${mechanic.area ? ` — ${mechanic.area}` : ''}`;

  const shareData = { title, text, url };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    onNotice?.('Link copied to clipboard');
  } catch {
    onNotice?.(url);
  }
}
