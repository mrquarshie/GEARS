const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

initializeApp();
const db = getFirestore();

// v1: read the whole users collection and filter in memory. Firestore
// can't range-filter on both lat and lng in one query without geohashing,
// and this is far simpler for a user base this size. Revisit with a
// geohash field + range queries if the users collection grows large
// enough that a full scan per new listing becomes expensive.
const NEARBY_RADIUS_KM = 5;

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findNearbyUserIds(lat, lng, excludeUid) {
  const usersSnap = await db.collection('users').get();
  const nearby = [];
  usersSnap.forEach((userDoc) => {
    if (userDoc.id === excludeUid) return;
    const location = userDoc.data().location;
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') return;
    if (haversineKm(lat, lng, location.lat, location.lng) <= NEARBY_RADIUS_KM) {
      nearby.push(userDoc.id);
    }
  });
  return nearby;
}

async function findBookmarkerUserIds(mechanicId, excludeUid) {
  const usersSnap = await db
    .collection('users')
    .where('savedMechanics', 'array-contains', mechanicId)
    .get();
  return usersSnap.docs.map((d) => d.id).filter((uid) => uid !== excludeUid);
}

// A deterministic notification doc ID (rather than auto-generated) makes
// this idempotent — a Cloud Function retry after a transient failure
// overwrites the same doc instead of sending the same notification twice.
async function writeNotifications(userIds, notificationId, payload) {
  await Promise.all(
    userIds.map((uid) =>
      db
        .collection('users')
        .doc(uid)
        .collection('notifications')
        .doc(notificationId)
        .set({ ...payload, read: false, createdAt: FieldValue.serverTimestamp() }),
    ),
  );
}

exports.onMechanicCreated = onDocumentCreated('mechanics/{mechanicId}', async (event) => {
  const mechanic = event.data?.data();
  const mechanicId = event.params.mechanicId;
  if (!mechanic || typeof mechanic.lat !== 'number' || typeof mechanic.lng !== 'number') return;

  const nearbyUserIds = await findNearbyUserIds(mechanic.lat, mechanic.lng, mechanic.createdBy);
  if (nearbyUserIds.length === 0) return;

  await writeNotifications(nearbyUserIds, `nearby-${mechanicId}`, {
    type: 'nearby',
    title: `${mechanic.name || 'A new business'} just joined Gears near you`,
    description: mechanic.area ? `Now listed in ${mechanic.area}.` : 'Check it out on the map.',
    mechanicId,
  });
});

async function notifyBookmarkersOfNewItem(mechanicId, itemId, itemName) {
  const mechanicSnap = await db.collection('mechanics').doc(mechanicId).get();
  if (!mechanicSnap.exists) return;
  const mechanic = mechanicSnap.data();

  const bookmarkerUserIds = await findBookmarkerUserIds(mechanicId, mechanic.createdBy);
  if (bookmarkerUserIds.length === 0) return;

  await writeNotifications(bookmarkerUserIds, `new-listing-${mechanicId}-${itemId}`, {
    type: 'new-listing',
    title: `${mechanic.name || 'A business you saved'} added something new`,
    description: itemName ? `${itemName} was just added to their catalog.` : 'Check out their updated catalog.',
    mechanicId,
  });
}

// A business adding several products/services in a row fires this once per
// item, so a saved user gets one notification per item, not a single
// digest — no batching/rate-limiting yet. Acceptable for now; revisit if
// it turns out to be noisy in practice.
exports.onProductCreated = onDocumentCreated('mechanics/{mechanicId}/products/{productId}', async (event) => {
  const product = event.data?.data();
  if (!product) return;
  await notifyBookmarkersOfNewItem(event.params.mechanicId, event.params.productId, product.name);
});

exports.onServiceCreated = onDocumentCreated('mechanics/{mechanicId}/services/{serviceId}', async (event) => {
  const service = event.data?.data();
  if (!service) return;
  await notifyBookmarkersOfNewItem(event.params.mechanicId, event.params.serviceId, service.name);
});
