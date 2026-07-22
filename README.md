# Gears

Gears is a Flutter app for finding nearby mechanics in Ghana. Anyone can browse and search listings without an account. A Firebase account is only required when someone adds a mechanic.

## Firebase setup

1. Create a Firebase project and enable **Authentication** (Email/Password) and **Cloud Firestore**.
2. Install the FlutterFire CLI, then run `flutterfire configure` from this folder. This creates `lib/firebase_options.dart` and adds the Android/iOS/Web Firebase configuration files.
3. Deploy the included Firestore rules with `firebase deploy --only firestore:rules`.

Until Firebase is configured, Gears opens with a small local sample directory so the browse experience is still available.

## Run

```bash
flutter pub get
flutter run -d chrome
```
