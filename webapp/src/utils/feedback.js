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

// A short mechanical "thump + ping" for significant clicks, so a tap
// confirms itself audibly (in addition to vibrateTap's haptic). Uses the
// Web Audio API, so it must be called from a user gesture; it no-ops
// silently if audio is unavailable or blocked.
export function playTapSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // Low mechanical thump — square wave, quick pitch drop.
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(220, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    gain1.gain.setValueAtTime(0.09, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.1);

    // Metallic "ping" — high sawtooth with a fast decay.
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(1400, now);
    osc2.frequency.exponentialRampToValueAtTime(500, now + 0.04);
    gain2.gain.setValueAtTime(0.025, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.01);
    osc2.stop(now + 0.06);
  } catch {
    // Audio unavailable — ignore.
  }
}

// Both the haptic buzz and the tap sound for the most important clicks.
export function tapFeedback(ms = 10) {
  vibrateTap(ms);
  playTapSound();
}
