import { getShareCardImage } from './shareCard';

// og:image (below) needs a plain static URL a link-preview crawler can fetch
// directly — it can't run the canvas-based card generator client-side runs
// for the actual Web Share sheet (see shareMechanic). Until per-business
// cards are pre-rendered server-side, every business's link preview uses this
// one fixed brand image instead.
const STATIC_OG_IMAGE = '/share-media-attachments/Mechanic.png';

export function getStaticShareImagePath(mechanic) {
  return mechanic?.shareImage || STATIC_OG_IMAGE;
}

export function getShareUrl(mechanic) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?mechanic=${encodeURIComponent(mechanic.id)}`;
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
