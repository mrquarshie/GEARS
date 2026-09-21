import { getShareCardImage } from './shareCard';

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

// Opens the OS share sheet with the business link and, where supported,
// attaches a share-card image generated live from the business's own data
// (name, area, tags, verified status, and an uploaded photo — see
// utils/shareCard.js) as the post's media. Falls back to copying the link
// when Web Share isn't available (desktop browsers).
export async function shareMechanic(mechanic, { onNotice } = {}) {
  const url = getShareUrl(mechanic);
  const title = mechanic.name;
  const text = `Check out ${mechanic.name} on GEARS${mechanic.area ? ` — ${mechanic.area}` : ''}`;

  let file = null;
  try {
    const blob = await getShareCardImage(mechanic);
    if (blob) {
      const filename = (mechanic.name || 'gears-business').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      file = new File([blob], `${filename}.png`, { type: 'image/png' });
    }
  } catch {
    // Card generation failed — share link/text only.
  }

  const shareData = file && navigator.canShare?.({ files: [file] })
    ? { title, text, url, files: [file] }
    : { title, text, url };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
      // Some browsers reject a files-share but accept a link-only one.
      if (file) {
        try {
          await navigator.share({ title, text, url });
          return;
        } catch (err2) {
          if (err2?.name === 'AbortError') return;
        }
      }
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    onNotice?.('Link copied to clipboard');
  } catch {
    onNotice?.(url);
  }
}
