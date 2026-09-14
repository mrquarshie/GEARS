const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

initializeApp();
const db = getFirestore();

// Kept in sync with ADMIN_EMAILS in webapp/src/main.jsx and firestore.rules.
const ADMIN_EMAILS = ['aciestech21@gmail.com', 'skyemmanuel42@gmail.com', 'princeessandoh316@gmail.com'];

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

async function notifyBookmarkersOfNewItem(mechanicId, itemName) {
  const mechanicSnap = await db.collection('mechanics').doc(mechanicId).get();
  if (!mechanicSnap.exists) return;
  const mechanic = mechanicSnap.data();

  const bookmarkerUserIds = await findBookmarkerUserIds(mechanicId, mechanic.createdBy);
  if (bookmarkerUserIds.length === 0) return;

  // Rate-limiting via a time-bucketed notification id: without this, a
  // business adding N products/services in a row would fan out N separate
  // notifications per bookmarker. Bucketing by hour makes repeated adds
  // within the window overwrite the same doc (idempotent, safe on retry)
  // and increment an itemCount instead of stacking.
  const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
  const bucket = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
  const notificationId = `new-listing-${mechanicId}-${bucket}`;
  const businessName = mechanic.name || 'A business you saved';

  await Promise.all(
    bookmarkerUserIds.map((uid) =>
      db.runTransaction(async (tx) => {
        const ref = db.collection('users').doc(uid).collection('notifications').doc(notificationId);
        const snap = await tx.get(ref);
        if (!snap.exists) {
          tx.set(ref, {
            type: 'new-listing',
            title: `${businessName} added something new`,
            description: itemName ? `${itemName} was just added to their catalog.` : 'Check out their updated catalog.',
            mechanicId,
            itemCount: 1,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
        } else {
          const count = (snap.data().itemCount || 1) + 1;
          tx.update(ref, {
            description: `${businessName} added ${count} new items to their catalog.`,
            itemCount: count,
            read: false,
          });
        }
      }),
    ),
  );
}

exports.onProductCreated = onDocumentCreated('mechanics/{mechanicId}/products/{productId}', async (event) => {
  const product = event.data?.data();
  if (!product) return;
  await notifyBookmarkersOfNewItem(event.params.mechanicId, product.name);
});

exports.onServiceCreated = onDocumentCreated('mechanics/{mechanicId}/services/{serviceId}', async (event) => {
  const service = event.data?.data();
  if (!service) return;
  await notifyBookmarkersOfNewItem(event.params.mechanicId, service.name);
});

// Rotates a pitch business's placeholder Firebase account to the real
// owner's email + password (Admin SDK — a client can't change another
// account's email). Returns the uid + new email so the admin can relay the
// credentials manually; actual delivery (email/SMS) is not wired up yet.
exports.handoffBusinessAccount = onCall(async (request) => {
  const callerEmail = request.auth?.token?.email || null;
  if (!callerEmail || !ADMIN_EMAILS.includes(callerEmail)) {
    throw new HttpsError('permission-denied', 'Only Gears admins can rotate business credentials.');
  }

  const { mechanicId, newEmail, newPassword } = request.data || {};
  if (!mechanicId || !newEmail || !newPassword) {
    throw new HttpsError('invalid-argument', 'mechanicId, newEmail, and newPassword are required.');
  }

  const mechanicSnap = await db.collection('mechanics').doc(mechanicId).get();
  if (!mechanicSnap.exists) {
    throw new HttpsError('not-found', 'No business with that id.');
  }
  const ownerUid = mechanicSnap.data().createdBy;
  if (!ownerUid) {
    throw new HttpsError('failed-precondition', 'That business has no owner account to rotate.');
  }

  await getAuth().updateUser(ownerUid, { email: newEmail, password: newPassword });

  return { uid: ownerUid, email: newEmail };
});
