// One-off script: pulls real filling stations across Ghana's major cities
// from the Google Places API (legacy Text Search) and writes them into
// src/mockExtras.json, replacing the old 4 hand-made placeholder Goil/Total
// entries. No fuel prices are fetched or written — just name + location, per
// the "just show their locations for now" instruction.
//
// Run it as:
//
//   node fetchFuelStations.mjs
//
// Requires GOOGLE_PLACES_API_KEY in webapp/.env (Places API enabled on that
// key/project). Does NOT touch Firestore — re-run `node seedLeads.mjs`
// afterwards to push the new set live (it dedupes by name, so safe to re-run).

import { readFileSync, writeFileSync } from 'fs';

function loadDotEnv(path) {
  const out = {};
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const env = loadDotEnv(new URL('./.env', import.meta.url));
const API_KEY = env.GOOGLE_PLACES_API_KEY;

if (!API_KEY) {
  console.error('GOOGLE_PLACES_API_KEY is empty in webapp/.env — add it first.');
  process.exit(1);
}

// Ghana's major cities/towns — one Text Search query per city. Each query
// returns up to 60 results across 3 pages (20 each), which comfortably
// covers a city's filling stations without excessive API usage.
const CITIES = [
  'Accra', 'Tema', 'Kumasi', 'Takoradi', 'Sekondi', 'Cape Coast',
  'Tamale', 'Sunyani', 'Ho', 'Koforidua', 'Techiman', 'Obuasi',
  'Wa', 'Bolgatanga', 'Nkawkaw', 'Aflao', 'Winneba', 'Berekum',
  'Madina', 'Kasoa', 'Suhum', 'Ashaiman',
];

async function textSearch(query) {
  const results = [];
  let pageToken = null;
  for (let page = 0; page < 3; page++) {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', query);
    url.searchParams.set('key', API_KEY);
    if (pageToken) url.searchParams.set('pagetoken', pageToken);

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn(`  [${query}] API status: ${data.status} ${data.error_message || ''}`);
      break;
    }
    results.push(...(data.results || []));

    if (!data.next_page_token) break;
    pageToken = data.next_page_token;
    // Google requires a short delay before a page token becomes valid.
    await new Promise((r) => setTimeout(r, 2000));
  }
  return results;
}

function deriveArea(formattedAddress, city) {
  if (!formattedAddress) return city;
  // Drop the trailing ", Ghana" and anything that looks like a plus-code.
  const cleaned = formattedAddress.replace(/,?\s*Ghana$/i, '').trim();
  return cleaned || city;
}

async function main() {
  const seen = new Map(); // place_id -> station
  const skippedClosed = [];

  for (const city of CITIES) {
    console.log(`Searching "${city}"...`);
    const queries = [`fuel station in ${city}, Ghana`, `filling station in ${city}, Ghana`];
    for (const q of queries) {
      const results = await textSearch(q);
      for (const r of results) {
        if (!r.place_id || seen.has(r.place_id)) continue;
        if (r.business_status === 'CLOSED_PERMANENTLY') {
          skippedClosed.push(r.name);
          continue;
        }
        if (!r.geometry?.location || !r.name) continue;

        seen.set(r.place_id, {
          name: r.name.trim(),
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
          area: deriveArea(r.formatted_address, city),
          specialty: 'Fuel Station',
          rating: r.rating != null ? String(r.rating) : 'New',
          ratingCount: r.user_ratings_total || 0,
          ratingSum: r.rating != null && r.user_ratings_total ? Math.round(r.rating * r.user_ratings_total) : 0,
          open: r.opening_hours?.open_now ?? null,
          placeId: r.place_id,
        });
      }
      // Stay well under Places API rate limits across ~44 queries.
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const stations = [...seen.values()];
  console.log(`\nFetched ${stations.length} unique filling stations (${skippedClosed.length} permanently-closed skipped).`);

  const mockExtrasPath = new URL('./src/mockExtras.json', import.meta.url);
  const mockExtras = JSON.parse(readFileSync(mockExtrasPath, 'utf8'));
  const nonFuel = mockExtras.filter((m) => m.specialty !== 'Fuel Station');
  const merged = [...nonFuel, ...stations];

  writeFileSync(mockExtrasPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(`Wrote ${stations.length} fuel stations into src/mockExtras.json (replaced the old placeholder set).`);
  console.log('Next: review the diff, then run `node seedLeads.mjs` to push these into Firestore.');
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
