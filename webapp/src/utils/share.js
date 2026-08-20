// Test set of share-card images (see public/share-media-attachments/). Until
// per-business cards are generated server-side, each business is
// deterministically assigned one of these so the same business always shares
// with the same image.
const SHARE_TEST_IMAGES = [
  '/share-media-attachments/Mechanic.png',
  '/share-media-attachments/Mechanic-1.png',
  '/share-media-attachments/BENZ FITTING SHOP.png',
  '/share-media-attachments/shell achimota.png',
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getShareImagePath(mechanic) {
  if (mechanic?.shareImage) return mechanic.shareImage;
  const key = mechanic?.id || mechanic?.name || 'default';
  return SHARE_TEST_IMAGES[hashString(key) % SHARE_TEST_IMAGES.length];
}

export function getShareUrl(mechanic) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?mechanic=${encodeURIComponent(mechanic.id)}`;
}

// Opens the OS share sheet with the business link and, where supported,
// attaches its share-card image as the post's media. Falls back to copying
// the link when Web Share isn't available (desktop browsers).
export async function shareMechanic(mechanic, { onNotice } = {}) {
  const url = getShareUrl(mechanic);
  const title = mechanic.name;
  const text = `Check out ${mechanic.name} on GEARS${mechanic.area ? ` — ${mechanic.area}` : ''}`;
  const imagePath = getShareImagePath(mechanic);

  let file = null;
  try {
    const res = await fetch(encodeURI(imagePath));
    if (res.ok) {
      const blob = await res.blob();
      file = new File([blob], imagePath.split('/').pop(), { type: blob.type || 'image/png' });
    }
  } catch {
    // Image unavailable — share link/text only.
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
