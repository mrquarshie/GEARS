// Vercel serverless function — serves a per-business Open Graph preview to
// link-unfurling bots (WhatsApp, Twitter/X, Facebook, iMessage, Telegram,
// Slack, Discord, etc.), then either those bots stop there or a real visitor
// gets redirected straight into the app.
//
// Why this has to be a separate route instead of just setting og:* tags in
// React (see MechanicDetailPanel's <Helmet>): this is a client-rendered SPA,
// and virtually none of those crawlers execute JavaScript — they fetch the
// raw HTML once and read whatever meta tags are already there. The tags
// Helmet sets never reach them; every shared link showed the same generic
// site-wide preview regardless of which business it pointed to.
//
// `mechanics` documents are publicly readable (firestore.rules: `allow read:
// if true`), so this hits the Firestore REST API directly with a plain GET —
// no service account/admin credentials needed.

const PROJECT_ID = 'gears-c88f8';
const SITE_URL = 'https://www.gears.live';
const FALLBACK_IMAGE = `${SITE_URL}/Logo/logo.png`;

// Covers the crawlers that actually matter for link previews. Anything not
// matched here is treated as a real visitor and bounced straight into the app.
const BOT_UA_REGEX = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|Slackbot|Discordbot|Googlebot|Google-InspectionTool|Pinterest|SkypeUriPreview|vkShare|Applebot|redditbot|Embedly|Iframely|W3C_Validator|Bitly|Outlook/i;

function parseFirestoreValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('doubleValue' in v) return v.doubleValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseFirestoreValue);
  if ('mapValue' in v) return parseFirestoreDoc(v.mapValue.fields || {});
  return null;
}

function parseFirestoreDoc(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) out[key] = parseFirestoreValue(value);
  return out;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toAbsoluteUrl(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${SITE_URL}${url}`;
}

// Prefers a real photo of the business over the generic brand fallback —
// logo first, then the first product/service thumbnail, then the first
// non-video media item (an og:image pointing at a .mp4 renders as nothing
// in most unfurlers).
function pickImage(mechanic) {
  const firstImageMedia = (mechanic.media || []).find((m) => m?.type !== 'video' && m?.url);
  return toAbsoluteUrl(
    mechanic.logoUrl
    || mechanic.products?.[0]?.imageUrl
    || mechanic.services?.[0]?.imageUrl
    || firstImageMedia?.url
  ) || FALLBACK_IMAGE;
}

export default async function handler(req, res) {
  const { id } = req.query;
  const userAgent = req.headers['user-agent'] || '';
  const appUrl = id ? `${SITE_URL}/?mechanic=${encodeURIComponent(id)}` : SITE_URL;

  // Not a crawler — get real visitors into the actual app immediately.
  if (!id || !BOT_UA_REGEX.test(userAgent)) {
    res.writeHead(302, { Location: appUrl });
    res.end();
    return;
  }

  let mechanic = null;
  try {
    const firestoreRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/mechanics/${encodeURIComponent(id)}`
    );
    if (firestoreRes.ok) {
      const json = await firestoreRes.json();
      mechanic = parseFirestoreDoc(json.fields || {});
    }
  } catch {
    // Falls through to the not-found branch below.
  }

  if (!mechanic || !mechanic.name) {
    res.writeHead(302, { Location: SITE_URL });
    res.end();
    return;
  }

  const title = mechanic.name;
  const description = mechanic.about
    || `Contact ${mechanic.name} in ${mechanic.area || 'Ghana'}.${mechanic.phone ? ` Call ${mechanic.phone}.` : ''}`;
  const image = pickImage(mechanic);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} | Gears</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(title)} | Gears">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(appUrl)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Gears">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)} | Gears">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(appUrl)}">
</head>
<body>
<p><a href="${escapeHtml(appUrl)}">${escapeHtml(title)} on Gears</a></p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Public + CDN cache: a business's share preview doesn't need to be
  // real-time fresh, and this keeps repeat unfurls (WhatsApp re-fetches on
  // every forward) from hitting Firestore each time.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400');
  res.status(200).send(html);
}
