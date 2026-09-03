import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../firebase';
import { getMechanicCategory } from '../components/MapLayout';

// Rendered at 2x so the exported PNG stays crisp when shared to socials/WhatsApp.
const CARD_W = 1080;
const PAD = 34;

// Same per-category branding used on the map pins (--marker-mechanic/-detailer/
// -fuel/-parts in styles.css) — reused here so a business reads as the same
// category color everywhere in the app, not just on the map.
const CATEGORY_ACCENT = {
  mechanic: '#d95f12',
  detailer: '#168f55',
  fuel: '#2477e8',
  parts: '#7c3aed',
};

// Layout below the photo band flows top-down from these gaps rather than
// fixed y-coordinates, and every text draw uses textBaseline 'top' — that's
// what keeps the block from ever drifting up into the photo above it
// regardless of font metrics (the bug in the previous fixed-offset version).
const PHOTO_TOP = 122;
const PHOTO_H = 794;
const NAME_SIZE = 64;
const AREA_SIZE = 32;
const TAG_SIZE = 28;
const TAG_H = 44;
const GAP_AFTER_PHOTO = 48;
const GAP_NAME_AREA = 14;
const GAP_AREA_TAGS = 22;
const GAP_TAGS_DIVIDER = 30;
const GAP_DIVIDER_CTA = 32;
const CTA_H = 68;
const BOTTOM_MARGIN = 44;

const VERIFIED_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path opacity="0.2" d="M14.5 8C14.5 8.78188 13.3863 9.37188 13.0825 10.1056C12.79 10.8131 13.1712 12.0212 12.5962 12.5962C12.0212 13.1712 10.8131 12.79 10.1056 13.0825C9.375 13.3863 8.78125 14.5 8 14.5C7.21875 14.5 6.625 13.3863 5.89437 13.0825C5.18687 12.79 3.97875 13.1712 3.40375 12.5962C2.82875 12.0212 3.21 10.8131 2.9175 10.1056C2.61375 9.375 1.5 8.78125 1.5 8C1.5 7.21875 2.61375 6.625 2.9175 5.89437C3.21 5.1875 2.82875 3.97875 3.40375 3.40375C3.97875 2.82875 5.1875 3.21 5.89437 2.9175C6.62812 2.61375 7.21875 1.5 8 1.5C8.78125 1.5 9.375 2.61375 10.1056 2.9175C10.8131 3.21 12.0212 2.82875 12.5962 3.40375C13.1712 3.97875 12.79 5.18687 13.0825 5.89437C13.3863 6.62812 14.5 7.21875 14.5 8Z" fill="#145E42"/><path d="M14.1163 6.42625C13.8806 6.18 13.6369 5.92625 13.545 5.70312C13.46 5.49875 13.455 5.16 13.45 4.83187C13.4406 4.22187 13.4306 3.53062 12.95 3.05C12.4694 2.56937 11.7781 2.55937 11.1681 2.55C10.84 2.545 10.5012 2.54 10.2969 2.455C10.0744 2.36312 9.82 2.11937 9.57375 1.88375C9.1425 1.46937 8.6525 1 8 1C7.3475 1 6.85812 1.46937 6.42625 1.88375C6.18 2.11937 5.92625 2.36312 5.70312 2.455C5.5 2.54 5.16 2.545 4.83187 2.55C4.22187 2.55937 3.53062 2.56937 3.05 3.05C2.56937 3.53062 2.5625 4.22187 2.55 4.83187C2.545 5.16 2.54 5.49875 2.455 5.70312C2.36312 5.92562 2.11937 6.18 1.88375 6.42625C1.46937 6.8575 1 7.3475 1 8C1 8.6525 1.46937 9.14187 1.88375 9.57375C2.11937 9.82 2.36312 10.0738 2.455 10.2969C2.54 10.5012 2.545 10.84 2.55 11.1681C2.55937 11.7781 2.56937 12.4694 3.05 12.95C3.53062 13.4306 4.22187 13.4406 4.83187 13.45C5.16 13.455 5.49875 13.46 5.70312 13.545C5.92562 13.6369 6.18 13.8806 6.42625 14.1163C6.8575 14.5306 7.3475 15 8 15C8.6525 15 9.14187 14.5306 9.57375 14.1163C9.82 13.8806 10.0738 13.6369 10.2969 13.545C10.5012 13.46 10.84 13.455 11.1681 13.45C11.7781 13.4406 12.4694 13.4306 12.95 12.95C13.4306 12.4694 13.4406 11.7781 13.45 11.1681C13.455 10.84 13.46 10.5012 13.545 10.2969C13.6369 10.0744 13.8806 9.82 14.1163 9.57375C14.5306 9.1425 15 8.6525 15 8C15 7.3475 14.5306 6.85812 14.1163 6.42625ZM13.3944 8.88188C13.095 9.19438 12.785 9.5175 12.6206 9.91438C12.4631 10.2956 12.4562 10.7312 12.45 11.1531C12.4437 11.5906 12.4369 12.0488 12.2425 12.2425C12.0481 12.4363 11.5931 12.4437 11.1531 12.45C10.7312 12.4562 10.2956 12.4631 9.91438 12.6206C9.5175 12.785 9.19438 13.095 8.88188 13.3944C8.56938 13.6937 8.25 14 8 14C7.75 14 7.42812 13.6925 7.11812 13.3944C6.80812 13.0962 6.4825 12.785 6.08563 12.6206C5.70438 12.4631 5.26875 12.4562 4.84688 12.45C4.40938 12.4437 3.95125 12.4369 3.7575 12.2425C3.56375 12.0481 3.55625 11.5931 3.55 11.1531C3.54375 10.7312 3.53687 10.2956 3.37937 9.91438C3.215 9.5175 2.905 9.19438 2.60562 8.88188C2.30625 8.56938 2 8.25 2 8C2 7.75 2.3075 7.42812 2.60562 7.11812C2.90375 6.80812 3.215 6.4825 3.37937 6.08563C3.53687 5.70438 3.54375 5.26875 3.55 4.84688C3.55625 4.40938 3.56312 3.95125 3.7575 3.7575C3.95187 3.56375 4.40688 3.55625 4.84688 3.55C5.26875 3.54375 5.70438 3.53687 6.08563 3.37937C6.4825 3.215 6.80562 2.905 7.11812 2.60562C7.43062 2.30625 7.75 2 8 2C8.25 2 8.57188 2.3075 8.88188 2.60562C9.19188 2.90375 9.5175 3.215 9.91438 3.37937C10.2956 3.53687 10.7312 3.54375 11.1531 3.55C11.5906 3.55625 12.0488 3.56312 12.2425 3.7575C12.4363 3.95187 12.4437 4.40688 12.45 4.84688C12.4562 5.26875 12.4631 5.70438 12.6206 6.08563C12.785 6.4825 13.095 6.80562 13.3944 7.11812C13.6937 7.43062 14 7.75 14 8C14 8.25 13.6925 8.57188 13.3944 8.88188ZM10.8538 6.14625C10.9002 6.19269 10.9371 6.24783 10.9623 6.30853C10.9874 6.36923 11.0004 6.43429 11.0004 6.5C11.0004 6.56571 10.9874 6.63077 10.9623 6.69147C10.9371 6.75217 10.9002 6.80731 10.8538 6.85375L7.35375 10.3538C7.30731 10.4002 7.25217 10.4371 7.19147 10.4623C7.13077 10.4874 7.06571 10.5004 7 10.5004C6.93429 10.5004 6.86923 10.4874 6.80853 10.4623C6.74783 10.4371 6.69269 10.4002 6.64625 10.3538L5.14625 8.85375C5.05243 8.75993 4.99972 8.63268 4.99972 8.5C4.99972 8.36732 5.05243 8.24007 5.14625 8.14625C5.24007 8.05243 5.36732 7.99972 5.5 7.99972C5.63268 7.99972 5.75993 8.05243 5.85375 8.14625L7 9.29313L10.1462 6.14625C10.1927 6.09976 10.2478 6.06288 10.3085 6.03772C10.3692 6.01256 10.4343 5.99961 10.5 5.99961C10.5657 5.99961 10.6308 6.01256 10.6915 6.03772C10.7522 6.06288 10.8073 6.09976 10.8538 6.14625Z" fill="#145E42"/></svg>`;

const WEB_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M16.36 14C16.44 13.34 16.5 12.68 16.5 12C16.5 11.32 16.44 10.66 16.36 10H19.74C19.9 10.64 20 11.31 20 12C20 12.69 19.9 13.36 19.74 14M14.59 19.56C15.19 18.45 15.65 17.25 15.97 16H18.92C17.9512 17.6683 16.4141 18.932 14.59 19.56ZM14.34 14H9.66C9.56 13.34 9.5 12.68 9.5 12C9.5 11.32 9.56 10.65 9.66 10H14.34C14.43 10.65 14.5 11.32 14.5 12C14.5 12.68 14.43 13.34 14.34 14ZM12 19.96C11.17 18.76 10.5 17.43 10.09 16H13.91C13.5 17.43 12.83 18.76 12 19.96ZM8 8H5.08C6.03864 6.32703 7.57466 5.06124 9.4 4.44C8.8 5.55 8.35 6.75 8 8ZM5.08 16H8C8.35 17.25 8.8 18.45 9.4 19.56C7.57827 18.9323 6.04429 17.6682 5.08 16ZM4.26 14C4.1 13.36 4 12.69 4 12C4 11.31 4.1 10.64 4.26 10H7.64C7.56 10.66 7.5 11.32 7.5 12C7.5 12.68 7.56 13.34 7.64 14M12 4.03C12.83 5.23 13.5 6.57 13.91 8H10.09C10.5 6.57 11.17 5.23 12 4.03ZM18.92 8H15.97C15.6565 6.76161 15.1931 5.56611 14.59 4.44C16.43 5.07 17.96 6.34 18.92 8ZM12 2C6.47 2 2 6.5 2 12C2 14.6522 3.05357 17.1957 4.92893 19.0711C5.85752 19.9997 6.95991 20.7362 8.17317 21.2388C9.38642 21.7413 10.6868 22 12 22C14.6522 22 17.1957 20.9464 19.0711 19.0711C20.9464 17.1957 22 14.6522 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7362 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2Z" fill="black"/></svg>`;

function svgToDataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function slugify(name) {
  return (name || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'business';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

// Only collections with a public `allow read: if true` rule in firestore.rules
// — `packages` has no matching rule yet, so it's deliberately left out here.
const PHOTO_SOURCES = ['media', 'products', 'services'];

// A real photo the business uploaded — `media` first (that's the "about this
// business" gallery), falling back to a catalog item photo so a business that
// hasn't visited the Media tab yet still gets a real photo, not nothing.
async function findBusinessPhoto(mechanic) {
  if (mechanic?.shareImage) return mechanic.shareImage;
  if (!db || !mechanic?.id) return null;
  for (const sub of PHOTO_SOURCES) {
    const snap = await getDocs(query(collection(db, `mechanics/${mechanic.id}/${sub}`), limit(6)));
    const withPhoto = snap.docs.map((d) => d.data()).find((d) => d.imageUrl);
    if (withPhoto) return withPhoto.imageUrl;
  }
  return null;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

// A pill with optional leading icon image. Sized to its content, so callers
// that need the resulting width (to place the next pill, or right-align)
// read it off the return value rather than guessing.
function drawPill(ctx, { x, y, height, bg, border, text, textColor, font, align = 'left', icon = null, iconSize = 0 }) {
  ctx.font = font;
  const textW = ctx.measureText(text).width;
  const iconGap = icon ? iconSize + 10 : 0;
  const width = textW + iconGap + height; // symmetric horizontal padding of half the pill height
  const drawX = align === 'right' ? x - width : x;

  ctx.fillStyle = bg;
  roundRect(ctx, drawX, y, width, height, height / 2);
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const contentStartX = drawX + height / 2;
  if (icon) {
    ctx.drawImage(icon, contentStartX, y + (height - iconSize) / 2, iconSize, iconSize);
  }
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, contentStartX + iconGap, y + height / 2 + 1);
  return { x: drawX, width };
}

function drawPhoto(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  ctx.drawImage(img, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
}

// Renders a business's share card as a PNG blob, pulling its own photo and
// details live from Firestore instead of the old fixed set of stock images —
// see utils/share.js's SHARE_TEST_IMAGES this replaces.
export async function getShareCardImage(mechanic) {
  const category = getMechanicCategory(mechanic?.specialty);
  const accent = CATEGORY_ACCENT[category] || CATEGORY_ACCENT.mechanic;

  // Everything below the photo band flows from a running cursor, so the total
  // card height is computed alongside it rather than hardcoded — the name/
  // area are single lines and the tags are a single row, so this is fully
  // deterministic (no reflow needed once real data is drawn in below).
  let cursorY = PHOTO_TOP + PHOTO_H + GAP_AFTER_PHOTO;
  const nameTop = cursorY;
  cursorY += NAME_SIZE * 1.2 + GAP_NAME_AREA;
  const areaTop = cursorY;
  cursorY += AREA_SIZE * 1.2 + GAP_AREA_TAGS;
  const tagsTop = cursorY;
  cursorY += TAG_H + GAP_TAGS_DIVIDER;
  const dividerY = cursorY;
  cursorY += GAP_DIVIDER_CTA;
  const ctaY = cursorY;
  cursorY += CTA_H + BOTTOM_MARGIN;
  const CARD_H = Math.round(cursorY);

  const [icons, photoUrl] = await Promise.all([
    Promise.all([loadImage(svgToDataUri(VERIFIED_ICON_SVG)), loadImage(svgToDataUri(WEB_ICON_SVG))])
      .then(([verified, web]) => ({ verified, web }))
      .catch(() => ({ verified: null, web: null })),
    findBusinessPhoto(mechanic).catch(() => null),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFCF5';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Photo band
  let photoLoaded = false;
  if (photoUrl) {
    try {
      const img = await loadImage(photoUrl);
      drawPhoto(ctx, img, 0, PHOTO_TOP, CARD_W, PHOTO_H);
      photoLoaded = true;
    } catch {
      // Bad/unreachable image URL — fall through to the flat category color.
    }
  }
  if (!photoLoaded) {
    ctx.fillStyle = accent;
    ctx.fillRect(0, PHOTO_TOP, CARD_W, PHOTO_H);
  }
  // Subtle scrim so a busy photo doesn't fight the header row above it.
  const scrim = ctx.createLinearGradient(0, PHOTO_TOP, 0, PHOTO_TOP + 140);
  scrim.addColorStop(0, 'rgba(0,0,0,0.18)');
  scrim.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, PHOTO_TOP, CARD_W, 140);

  // Header: GEARS wordmark + verified pill
  ctx.fillStyle = '#0D7A4D';
  roundRect(ctx, PAD, 30, 64, 64, 16);
  ctx.fill();
  ctx.fillStyle = '#D6F26B';
  ctx.font = '700 32px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('G', PAD + 32, 30 + 33);

  ctx.fillStyle = '#0D7A4D';
  ctx.font = '600 48px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('GEARS', PAD + 64 + 22, 30 + 44);

  if (mechanic?.verified) {
    drawPill(ctx, {
      x: CARD_W - PAD,
      y: 30,
      height: 44,
      bg: '#FAFAFA',
      border: 'rgba(0,0,0,0.08)',
      text: 'Verified',
      textColor: '#145E42',
      font: '500 30px "SF Pro Text", -apple-system, sans-serif',
      align: 'right',
      icon: icons.verified,
      iconSize: 28,
    });
  }

  // Business name, area, tags — textBaseline 'top' anchors each block to the
  // computed cursor position above, independent of font ascent/descent.
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000';
  ctx.font = `800 ${NAME_SIZE}px "SF Pro Text", -apple-system, sans-serif`;
  ctx.fillText(truncateToWidth(ctx, (mechanic?.name || 'Business').toUpperCase(), CARD_W - PAD * 2), PAD, nameTop);

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.font = `500 ${AREA_SIZE}px "SF Pro Text", -apple-system, sans-serif`;
  if (mechanic?.area) ctx.fillText(truncateToWidth(ctx, mechanic.area, CARD_W - PAD * 2), PAD, areaTop);
  ctx.textBaseline = 'alphabetic';

  const tags = (Array.isArray(mechanic?.specialties) && mechanic.specialties.length
    ? mechanic.specialties
    : mechanic?.specialty ? [mechanic.specialty] : []
  ).slice(0, 3);
  let tagX = PAD;
  const tagFont = `500 ${TAG_SIZE}px "SF Pro Text", -apple-system, sans-serif`;
  tags.forEach((tag) => {
    const { width } = drawPill(ctx, {
      x: tagX,
      y: tagsTop,
      height: TAG_H,
      bg: '#FAFAFA',
      border: 'rgba(0,0,0,0.05)',
      text: tag,
      textColor: '#145E42',
      font: tagFont,
    });
    tagX += width + 16;
  });

  // Divider
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, dividerY);
  ctx.lineTo(CARD_W - PAD, dividerY);
  ctx.stroke();

  // Category-colored CTA pill + a circular website-link button
  const circleSize = CTA_H;
  const ctaMaxWidth = CARD_W - PAD * 2 - circleSize - 24;
  ctx.font = '600 28px "SF Pro Text", -apple-system, sans-serif';
  const domain = truncateToWidth(ctx, `gears.app/${slugify(mechanic?.name)}`, ctaMaxWidth - 48);
  drawPill(ctx, {
    x: PAD,
    y: ctaY,
    height: CTA_H,
    bg: accent,
    text: domain,
    textColor: '#fff',
    font: '600 28px "SF Pro Text", -apple-system, sans-serif',
  });

  const circleX = CARD_W - PAD - circleSize;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(circleX + circleSize / 2, ctaY + CTA_H / 2, circleSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (icons.web) {
    const iconSize = circleSize * 0.52;
    ctx.drawImage(icons.web, circleX + (circleSize - iconSize) / 2, ctaY + (CTA_H - iconSize) / 2, iconSize, iconSize);
  }

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}
