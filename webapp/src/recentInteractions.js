// Tracks the single most recent explicit action (call/bookmark/direction/rate)
// per mechanic, so the list card can show "Called 2 min ago" etc. Entries
// older than MAX_AGE_MS stop being shown (per-card, not deleted outright —
// they just age out of the render check below).
const STORAGE_KEY = 'gearsRecentInteractions';
export const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export function loadRecentInteractions() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    return {};
  }
}

export function saveRecentInteractions(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable — interaction badges just won't persist
  }
}

// "2 min - 2 hr - 2 d" — minutes under an hour, hours under a day, days
// after that, up to the MAX_AGE_MS cutoff enforced by the caller.
export function formatRelativeTime(timestamp) {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export function getRecentInteraction(recentInteractions, mechanicId) {
  const entry = recentInteractions[mechanicId];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > MAX_AGE_MS) return null;
  return entry;
}
