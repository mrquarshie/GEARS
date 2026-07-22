# Gears Ghana — Setup Guide

A step-by-step guide to get both the React web app and Flutter mobile app running end-to-end with Firebase.

---

## Prerequisites

| Tool | Install |
|---|---|
| Node.js ≥ 18 | https://nodejs.org |
| Flutter ≥ 3.9 | https://flutter.dev/docs/get-started/install |
| Firebase CLI | `npm install -g firebase-tools` |
| FlutterFire CLI | `dart pub global activate flutterfire_cli` |
| Git | https://git-scm.com |

---

## Step 1 — Create a Firebase Project

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"**
3. Name it (e.g. `gears-ghana`) → continue through the steps
4. Once created, go to **Build → Authentication → Get started**
   - Enable **Email/Password** sign-in method
5. Go to **Build → Firestore Database → Create database**
   - Choose **"Start in production mode"** (the rules in `firestore.rules` are already correct)
   - Pick a region close to Ghana (e.g. `europe-west1`)

---

## Step 2 — Configure the Web App

1. In the Firebase Console → Project Settings (gear icon) → **"Your apps"** → click **"Add app"** → Web
2. Register the app (name it anything, e.g. `gears-web`), skip Firebase Hosting
3. Copy the config object values shown
4. In your project, create `webapp/.env` (copy from `webapp/.env.example`):

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=gears-ghana.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gears-ghana
VITE_FIREBASE_STORAGE_BUCKET=gears-ghana.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

> ⚠️ Never commit `.env` to Git. It is already in `.gitignore`.

### Run the web app locally

```bash
cd webapp
npm install
npm run dev
```

Open http://localhost:5173 — you should see the app connected to Firebase.

---

## Step 3 — Configure Flutter (Android + iOS)

### 3a. Register Android and iOS apps in Firebase

1. Firebase Console → Project Settings → Add app → **Android**
   - Package name: find it in `android/app/build.gradle` → `applicationId`
   - Download `google-services.json`
   - Place it at: `android/app/google-services.json`

2. Firebase Console → Project Settings → Add app → **iOS**
   - Bundle ID: find it in Xcode → Target → General → Bundle Identifier
   - Download `GoogleService-Info.plist`
   - Place it at: `ios/Runner/GoogleService-Info.plist`

### 3b. Generate firebase_options.dart (recommended)

Run in the project root:

```bash
firebase login
flutterfire configure
```

This will:
- Detect your Firebase project
- Generate `lib/firebase_options.dart`
- Auto-configure Android and iOS

Then update `lib/main.dart` — find the comment and replace:

```dart
// BEFORE (current code):
await Firebase.initializeApp();

// AFTER (once firebase_options.dart is generated):
import 'package:gears/firebase_options.dart';
// ...
await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
```

### 3c. Install Flutter packages

```bash
flutter pub get
```

### 3d. Run the Flutter app

```bash
# Android (with device/emulator connected):
flutter run

# iOS:
flutter run -d ios
```

---

## Step 4 — Deploy Firestore Security Rules

```bash
firebase login
firebase deploy --only firestore:rules
```

---

## Step 5 — Deploy Web App to Vercel

### Option A — Via Vercel Dashboard (easiest)

1. Push your code to GitHub
2. Go to **https://vercel.com** → New Project → Import your GitHub repo
3. Set the **Root Directory** to `webapp`
4. Vercel will auto-detect Vite
5. In Vercel Project Settings → **Environment Variables**, add all 6 `VITE_FIREBASE_*` values

### Option B — Via Vercel CLI

```bash
npm install -g vercel
cd webapp
vercel --prod
```

When prompted, set the root to `webapp/` and add your env vars.

---

## Firestore Data Structure

Each mechanic document in the `mechanics` collection:

```json
{
  "name": "Kofi Auto Works",
  "area": "Osu, Accra",
  "specialty": "Engine diagnostics · AC",
  "distance": "0.8 km away",
  "rating": "4.9",
  "phone": "024 123 4567",
  "open": true,
  "createdBy": "uid-of-auth-user",
  "createdAt": "2026-07-11T..."
}
```

> **Note on `createdBy`:** The Firestore rules allow users to update/delete their own listings, but this requires storing the user's UID on create. Update `submitMechanic` in the web app and `_showAddSheet` in Flutter to include `createdBy: FirebaseAuth.instance.currentUser!.uid`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Web app shows sample data only | Check that `webapp/.env` exists and all 6 variables are set |
| Flutter crash on start | Run `flutterfire configure` and update `Firebase.initializeApp()` |
| `google-services.json` not found | Place it in `android/app/`, not the project root |
| Firestore writes rejected | Check that the user is signed in; check rules with Firebase Emulator |
| `url_launcher` not opening dialler | On Android, add `<queries>` intent for `tel:` in `AndroidManifest.xml` |

### Android — url_launcher tel: intent fix

Add to `android/app/src/main/AndroidManifest.xml` inside `<manifest>`:

```xml
<queries>
  <intent>
    <action android:name="android.intent.action.DIAL" />
    <data android:scheme="tel" />
  </intent>
</queries>
```
