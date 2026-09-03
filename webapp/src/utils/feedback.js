// A short, subtle buzz for "this button was interacted with" — used
// broadly across significant actions (bookmark, call, share, direction,
// rate, business dashboard actions) so tapping something always confirms
// itself, the way a native app's haptics do.
//
// iOS Safari has never implemented the Vibration API, even installed as a
// PWA — navigator.vibrate is simply undefined there, so this silently
// no-ops on iPhone/iPad. It still works on Android Chrome/Firefox.
export function vibrateTap(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Unsupported or blocked — ignore.
  }
}
