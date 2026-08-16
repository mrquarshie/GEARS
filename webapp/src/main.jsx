import { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import mockExtrasData from './mockExtras.json';
import { loadRecentInteractions, saveRecentInteractions } from './recentInteractions';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { List, NavigationArrow, Gear, X, Plus, SealCheck, MagnifyingGlass } from '@phosphor-icons/react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  where,
  deleteDoc,
  updateDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import {
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import { auth, db, firebaseReady } from './firebase';
import './styles.css';

import Sidebar from './components/Sidebar';
import MapLayout, { getMechanicCategory, buildCategoryMarkerIcon } from './components/MapLayout';
import MechanicListPanel from './components/MechanicListPanel';
import MechanicDetailPanel from './components/MechanicDetailPanel';
import SearchPanel from './components/SearchPanel';
import NotificationsPanel from './components/NotificationsPanel';
import BusinessDashboard from './components/BusinessDashboard';

import authImgCar from './components/AuthImages/Car.png';
import authImgSteer from './components/AuthImages/Steer.png';
import authImgEngine from './components/AuthImages/Engine.png';
import authImgBattery from './components/AuthImages/Car battery.png';

// ---------------------------------------------------------------------------
// Utility: interactive + readonly star rating
// ---------------------------------------------------------------------------
function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;
  return (
    <div className="star-picker" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn ${active >= n ? 'lit' : ''}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rate Modal
// ---------------------------------------------------------------------------
function RateModal({ mechanic, user, close, onRated, show, openAuth }) {
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [existing, setExisting] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  const tagsList = ["Quality Service", "On Time", "Affordable", "Safe", "Excellent Job", "Good Conversation"];
  const starLabels = { 1: 'Terrible', 2: 'Bad', 3: 'Satisfied', 4: 'Good', 5: 'Excellent' };


  useEffect(() => {
    if (!db || !user || !mechanic.id) { setLoadingExisting(false); return; }
    getDoc(doc(db, 'mechanics', mechanic.id, 'ratings', user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const v = data.value || 0;
          setExisting(v);
          setSelected(v);
          setSelectedTags(data.tags || []);
          setCommentText(data.comment || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false));
  }, [mechanic.id, user]);

  const toggleTag = (t) => {
    if (selectedTags.includes(t)) {
      setSelectedTags(selectedTags.filter(x => x !== t));
    } else {
      setSelectedTags([...selectedTags, t]);
    }
  };

  const submit = async () => {
    if (!selected) return show('Please pick a star rating first.');
    if (!db) return show('Firebase is not connected.');
    if (!user) { close(); openAuth(); return; }
    if (!mechanic.id) return show('This listing has no ID yet — try refreshing.');

    setSubmitting(true);
    try {
      let newRating = mechanic.rating;
      const mechanicRef = doc(db, 'mechanics', mechanic.id);
      const ratingRef = doc(db, 'mechanics', mechanic.id, 'ratings', user.uid);

      await runTransaction(db, async (tx) => {
        const [mSnap, rSnap] = await Promise.all([
          tx.get(mechanicRef),
          tx.get(ratingRef),
        ]);

        const data = mSnap.data() || {};
        let count = data.ratingCount || 0;
        let sum   = data.ratingSum   || 0;

        if (rSnap.exists()) {
          sum = sum - (rSnap.data().value || 0) + selected;
        } else {
          sum   += selected;
          count += 1;
        }

        newRating = count > 0 ? (sum / count).toFixed(1) : selected.toString();
        tx.update(mechanicRef, { rating: newRating, ratingCount: count, ratingSum: sum });
        tx.set(ratingRef, { 
          value: selected, 
          tags: selectedTags,
          comment: commentText,
          ratedAt: new Date(),
          userName: user.displayName || user.email || 'Anonymous',
          userId: user.uid
        });
      });

      setExisting(selected);
      onRated(mechanic.id, newRating);
      show(`You rated ${mechanic.name} ${selected} star${selected !== 1 ? 's' : ''}. Thanks!`);
      close();
    } catch (err) {
      console.error(err);
      show('Could not save your rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeStar = hovered || selected;

  return (
    <div className="rate-modal-overlay" role="dialog" aria-modal="true" onClick={close}>
      <div className="rate-modal-content" onClick={e => e.stopPropagation()}>
        <div className="mobile-drag-handle"></div>
        <button type="button" className="rate-modal-close" onClick={close} aria-label="Close">×</button>

        <div className="rate-modal-scroll">
          <h2 className="rate-modal-title">Rate {mechanic.name}</h2>

          {loadingExisting ? (
            <div style={{ padding: '40px 0', color: 'var(--muted)' }}>Loading...</div>
          ) : (
            <>
              <div className="rate-stars-container">
                <div>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`rate-star-btn ${activeStar >= n ? 'lit' : ''}`}
                      onClick={() => setSelected(n)}
                      onMouseEnter={() => setHovered(n)}
                      onMouseLeave={() => setHovered(0)}
                      aria-label={`${n} star${n !== 1 ? 's' : ''}`}
                    >
                      {activeStar >= n ? '★' : '☆'}
                    </button>
                  ))}
                </div>
                <div className="rate-stars-label">
                  {activeStar > 0 ? starLabels[activeStar] : 'Select a rating'}
                </div>
              </div>

              <div className="rate-tags-container">
                {tagsList.map(t => (
                  <button
                    key={t}
                    className={`rate-tag ${selectedTags.includes(t) ? 'active' : ''}`}
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <label className="rate-comment-label">Leave A Comment</label>
              <textarea
                className="rate-textarea"
                placeholder="Your Comment"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
              />

              <button className="rate-submit-btn" disabled={submitting || !selected} onClick={submit}>
                {submitting ? 'Saving...' : 'Submit'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth Modal
// ---------------------------------------------------------------------------
function GoogleGLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

// Headline shown per sign-in reason, so the prompt explains why the user was
// stopped instead of a generic message that doesn't match what they tapped.
const AUTH_REASON_COPY = {
  bookmark: 'Sign up to bookmark a mechanic shop or retailer.',
  rate: 'Sign up to rate and review.',
  business: 'Sign up to list and manage your business.',
};

function AuthModal({ close, onSuccess, reason }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const headline = AUTH_REASON_COPY[reason] || 'Find trusted mechanics, anywhere in Ghana.';

  const loginWithGoogle = async () => {
    if (reason === 'business') {
      onSuccess(null);
      return;
    }
    if (!firebaseReady) return setErrorMsg('Add your Firebase settings to .env first.');
    setLoading(true);
    setErrorMsg('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) onSuccess(result.user);
    } catch (err) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-cancelled-by-user') {
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
        } catch (redirectErr) {
          setErrorMsg(redirectErr.message.replace('Firebase: ', ''));
          setLoading(false);
        }
      } else {
        setErrorMsg(err.message.replace('Firebase: ', ''));
        setLoading(false);
      }
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className={`auth-modal-content ${reason === 'business' ? 'auth-modal-content--business' : ''}`}>
        <button type="button" className="auth-close" onClick={close} aria-label="Close">
          <X size={18} />
        </button>

        <div className="auth-header-graphics">
          <img className="auth-deco auth-deco-big" src={authImgCar} alt="" />
          <img className="auth-deco auth-deco-top-center" src={authImgSteer} alt="" />
          <img className="auth-deco auth-deco-top-right" src={authImgEngine} alt="" />
          <img className="auth-deco auth-deco-bottom-left" src={authImgBattery} alt="" />
          <div className="auth-logo-box">
            <Gear size={26} color="var(--lime)" weight="fill" className="logo-gear-spin" />
          </div>
        </div>

        <div className="auth-body">
          <h2>{headline}</h2>

          {errorMsg && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>{errorMsg}</div>}

          <button type="button" className="google-auth-btn" onClick={loginWithGoogle} disabled={loading}>
            <span className="google-icon-wrapper">
              <GoogleGLogo size={18} />
            </span>
            <span className="google-auth-divider"></span>
            <p style={{width:'100%'}}>{reason === 'business' ? 'Continue with Google' : loading ? 'Please wait…' : 'Continue with Google'}</p>
          </button>

          <p className="auth-terms">By using Gears, you agree to our Terms of Service<br />and Privacy Policy.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add / Edit Mechanic Modal
// ---------------------------------------------------------------------------
// Same CARTO Voyager tiles the main map uses, so this picker matches the
// rest of the app instead of looking like a different, generic map.
const BIZ_TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const BIZ_TILE_SUBDOMAINS = 'abcd';
const BIZ_TILE_ATTRIBUTION = '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Nominatim's display_name is a full mailing-address string (e.g. "Accra
// International Airport, Airport Bypass, Airport Residential Area, Accra
// Metropolitan District, Greater Accra Region, Ghana"). Everywhere else in
// the app, a location is just "Area, Region" (see mockExtras.json), so pull
// the neighbourhood/town and region out of Nominatim's structured address
// instead of showing the whole string.
function formatShortLocation(address, fallbackDisplayName) {
  if (!address) return fallbackDisplayName || '';
  const area =
    address.suburb ||
    address.neighbourhood ||
    address.quarter ||
    address.city_district ||
    address.town ||
    address.village ||
    address.city ||
    address.county;
  const region = (address.state || address.region || address.county || '').replace(/\s+Region$/i, '');
  if (area && region && area !== region) return `${area}, ${region}`;
  return area || region || fallbackDisplayName || '';
}

function LocationPicker({ lat, lng, setLat, setLng, category, label, onInteract }) {
  useMapEvents({
    click(e) {
      setLat(e.latlng.lat);
      setLng(e.latlng.lng);
      onInteract?.();
    },
  });
  // Same category pin (colored glyph avatar + name) every other marker on
  // the real map uses — not a bespoke picker-only style.
  const icon = useMemo(
    () => buildCategoryMarkerIcon(getMechanicCategory(category), label),
    [category, label],
  );
  return lat && lng ? (
    <Marker
      position={[lat, lng]}
      icon={icon}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const pos = e.target.getLatLng();
          setLat(pos.lat);
          setLng(pos.lng);
          onInteract?.();
        },
      }}
    />
  ) : null;
}

// Flies the map to [lat, lng] whenever `trigger` changes (e.g. after picking
// a search suggestion or resolving the user's GPS location) — but not on
// every lat/lng change, so tapping/dragging the pin directly doesn't also
// trigger a redundant fly animation to where the map already is.
function MapFlyTo({ lat, lng, trigger }) {
  const map = useMap();
  useEffect(() => {
    if (!trigger) return;
    map.flyTo([lat, lng], 16, { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return null;
}

const BUSINESS_TYPES = {
  mechanic: {
    title: 'Become A Mechanic',
    shortTitle: 'Mechanic',
    subtitle: 'Repair, inspect and service vehicles.',
    category: 'General repairs',
    nameLabel: 'Garage Or Mechanic Name',
    namePlaceholder: 'eg. Jack\'s Garage',
    aboutPlaceholder: 'Describe the repairs and vehicle services you offer',
    locationHint: 'Place the pin at your garage or workshop.',
    icon: 'gear',
    specialtiesIntro: 'Pick the repairs you specialize in. Customers search by these, so accurate choices help the right people find your garage.',
    specialties: [
      'General Repairs', 'Auto Repairs', 'Diagnostics', 'Auto-Electrical', 'Engine Repair',
      'Brakes', 'Suspension', 'Transmission', 'Oil Change', 'Wheel Alignment', 'AC Repair',
      'Clutch Repair', 'Exhaust System', 'Battery Service',
    ],
    successTitle: 'Mechanic Shop Created Successfully',
  },
  shop: {
    title: 'Continue As An Auto Shop Owner',
    shortTitle: 'Auto Shop',
    subtitle: 'Sell parts, oils, tyres and accessories.',
    category: 'Auto Parts',
    nameLabel: 'Shop Name',
    namePlaceholder: 'eg. Adum Auto Parts',
    aboutPlaceholder: 'Describe the parts, brands or orders you handle',
    locationHint: 'Place the pin at your shop entrance.',
    icon: 'shop',
    specialtiesIntro: 'Pick what you stock or sell. Customers search by these, so accurate choices help the right people find your shop.',
    specialties: [
      'Auto Parts', 'New Parts', 'Used Parts', 'Import Orders', 'Tyres', 'Batteries',
      'Lubricants', 'Filters', 'Car Accessories', 'Wheels & Rims', 'Car Audio', 'Tools & Equipment',
    ],
    successTitle: 'Auto Shop Created Successfully',
  },
  detailer: {
    title: 'Get Started As Detailer',
    shortTitle: 'Detailer',
    subtitle: 'Offer car wash, detailing and finish care.',
    category: 'Car Detailing',
    nameLabel: 'Detailing Business Name',
    namePlaceholder: 'eg. Shine Lab Detailers',
    aboutPlaceholder: 'Describe your wash, detailing or coating services',
    locationHint: 'Place the pin at your bay or studio.',
    icon: 'detailer',
    specialtiesIntro: 'Pick the services you offer. Customers search by these, so accurate choices help the right people find you.',
    specialties: [
      'Hand Wash', 'Full Detailing', 'Interior Detailing', 'Ceramic Coating', 'Paint Correction',
      'Engine Bay Cleaning', 'Headlight Restoration', 'Window Tinting', 'Upholstery Cleaning', 'Odor Removal',
    ],
    successTitle: 'Detailing Business Created Successfully',
  },
  fuel: {
    title: 'Fuel Station Agent',
    shortTitle: 'Fuel Station',
    subtitle: 'List a station for fuel, LPG and forecourt services.',
    category: 'Fuel Station',
    nameLabel: 'Fuel Station Name',
    namePlaceholder: 'eg. Queens Road Fuel Station',
    aboutPlaceholder: 'Describe available fuels and station services',
    locationHint: 'Place the pin at the station forecourt.',
    icon: 'fuel',
    specialtiesIntro: '',
    specialties: [],
    successTitle: 'Fuel Station Created Successfully',
  },
};


function BizTypeGearIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.2" d="M19.4903 11.5481L21.0634 9.57932C20.8513 8.7817 20.5338 8.01591 20.1194 7.30213L17.6162 7.02088C17.4163 6.79559 17.2031 6.5824 16.9778 6.38244L16.6966 3.87838C15.982 3.46647 15.2159 3.15122 14.4184 2.94088L12.4497 4.51307C12.1487 4.49525 11.8469 4.49525 11.5459 4.51307L9.57719 2.93994C8.78216 3.15275 8.01893 3.47021 7.3075 3.884L7.02625 6.38713C6.80096 6.58709 6.58777 6.80028 6.38781 7.02557L3.88375 7.30682C3.47184 8.02137 3.15659 8.78744 2.94625 9.58494L4.51844 11.5537C4.50063 11.8547 4.50063 12.1565 4.51844 12.4574L2.94531 14.4262C3.1575 15.2238 3.47497 15.9896 3.88938 16.7034L6.3925 16.9846C6.59246 17.2099 6.80565 17.4231 7.03094 17.6231L7.31219 20.1271C8.02674 20.539 8.79281 20.8543 9.59031 21.0646L11.5591 19.4924C11.86 19.5103 12.1618 19.5103 12.4628 19.4924L14.4316 21.0656C15.2292 20.8534 15.995 20.5359 16.7087 20.1215L16.99 17.6184C17.2153 17.4184 17.4285 17.2052 17.6284 16.9799L20.1325 16.6987C20.5444 15.9841 20.8597 15.2181 21.07 14.4206L19.4978 12.4518C19.5131 12.1507 19.5106 11.8489 19.4903 11.5481ZM12.0034 15.7499C11.2618 15.7499 10.5367 15.53 9.92005 15.118C9.30337 14.7059 8.82272 14.1202 8.53889 13.435C8.25506 12.7498 8.1808 11.9958 8.32549 11.2684C8.47019 10.5409 8.82734 9.87274 9.35179 9.34829C9.87623 8.82384 10.5444 8.46669 11.2718 8.322C11.9993 8.1773 12.7533 8.25156 13.4385 8.53539C14.1237 8.81922 14.7094 9.29987 15.1214 9.91655C15.5335 10.5332 15.7534 11.2583 15.7534 11.9999C15.7534 12.9945 15.3583 13.9483 14.6551 14.6516C13.9518 15.3549 12.998 15.7499 12.0034 15.7499Z" fill="black" />
      <path d="M11.9976 7.50004C11.1076 7.50004 10.2376 7.76396 9.49754 8.25843C8.75751 8.7529 8.18074 9.4557 7.84014 10.278C7.49955 11.1002 7.41043 12.005 7.58407 12.878C7.7577 13.7509 8.18629 14.5527 8.81562 15.182C9.44496 15.8114 10.2468 16.2399 11.1197 16.4136C11.9926 16.5872 12.8974 16.4981 13.7197 16.1575C14.5419 15.8169 15.2447 15.2401 15.7392 14.5001C16.2337 13.7601 16.4976 12.8901 16.4976 12C16.4964 10.807 16.0219 9.66308 15.1782 8.81943C14.3346 7.97579 13.1907 7.50128 11.9976 7.50004ZM11.9976 15C11.4043 15 10.8242 14.8241 10.3309 14.4945C9.83754 14.1648 9.45303 13.6963 9.22596 13.1481C8.9989 12.5999 8.93949 11.9967 9.05525 11.4148C9.171 10.8328 9.45672 10.2983 9.87628 9.87872C10.2958 9.45917 10.8304 9.17344 11.4123 9.05769C11.9943 8.94193 12.5975 9.00134 13.1457 9.2284C13.6938 9.45547 14.1624 9.83999 14.492 10.3333C14.8217 10.8267 14.9976 11.4067 14.9976 12C14.9976 12.7957 14.6815 13.5588 14.1189 14.1214C13.5563 14.684 12.7933 15 11.9976 15ZM20.2476 12.2025C20.2514 12.0675 20.2514 11.9325 20.2476 11.7975L21.6464 10.05C21.7197 9.95829 21.7705 9.8506 21.7946 9.73563C21.8187 9.62067 21.8154 9.50165 21.7851 9.38817C21.5554 8.52637 21.2124 7.69884 20.7651 6.92723C20.7065 6.82628 20.6251 6.7404 20.5275 6.67644C20.4298 6.61248 20.3186 6.57219 20.2026 6.55879L17.9789 6.31129C17.8864 6.21379 17.7926 6.12004 17.6976 6.03004L17.4351 3.80067C17.4216 3.68462 17.3812 3.57333 17.317 3.47567C17.2529 3.37801 17.1669 3.29668 17.0657 3.23817C16.2942 2.79121 15.4666 2.44884 14.6048 2.22004C14.4913 2.18972 14.3723 2.18648 14.2573 2.21058C14.1424 2.23468 14.0347 2.28545 13.9429 2.35879L12.2001 3.75004C12.0651 3.75004 11.9301 3.75004 11.7951 3.75004L10.0476 2.35411C9.95585 2.28076 9.84815 2.23 9.73319 2.2059C9.61823 2.1818 9.49921 2.18504 9.38573 2.21536C8.52393 2.44507 7.6964 2.78806 6.92479 3.23536C6.82384 3.29397 6.73796 3.37535 6.674 3.473C6.61004 3.57065 6.56975 3.68189 6.55635 3.79786L6.30885 6.02536C6.21135 6.11848 6.1176 6.21223 6.0276 6.30661L3.79823 6.56254C3.68218 6.57604 3.57088 6.61647 3.47322 6.6806C3.37556 6.74473 3.29424 6.83079 3.23573 6.93192C2.78886 7.70363 2.4462 8.53114 2.21666 9.39286C2.18647 9.50641 2.18339 9.62547 2.20765 9.74044C2.23191 9.8554 2.28285 9.96306 2.35635 10.0547L3.7476 11.7975C3.7476 11.9325 3.7476 12.0675 3.7476 12.2025L2.35166 13.95C2.27832 14.0418 2.22756 14.1495 2.20346 14.2645C2.17936 14.3794 2.1826 14.4984 2.21291 14.6119C2.44263 15.4737 2.78562 16.3012 3.23291 17.0729C3.29153 17.1738 3.37291 17.2597 3.47056 17.3236C3.56821 17.3876 3.67945 17.4279 3.79541 17.4413L6.01916 17.6888C6.11229 17.7863 6.20604 17.88 6.30041 17.97L6.5601 20.1994C6.5736 20.3155 6.61403 20.4268 6.67816 20.5244C6.74229 20.6221 6.82835 20.7034 6.92948 20.7619C7.70119 21.2088 8.5287 21.5514 9.39041 21.781C9.50397 21.8112 9.62303 21.8143 9.73799 21.79C9.85296 21.7657 9.96062 21.7148 10.0523 21.6413L11.7951 20.25C11.9301 20.2538 12.0651 20.2538 12.2001 20.25L13.9476 21.6488C14.0394 21.7221 14.147 21.7729 14.262 21.797C14.377 21.8211 14.496 21.8179 14.6095 21.7875C15.4714 21.5582 16.299 21.2152 17.0704 20.7675C17.1714 20.7089 17.2572 20.6276 17.3212 20.5299C17.3852 20.4322 17.4255 20.321 17.4389 20.205L17.6864 17.9813C17.7839 17.8888 17.8776 17.795 17.9676 17.7L20.197 17.4375C20.313 17.424 20.4243 17.3836 20.522 17.3195C20.6196 17.2554 20.701 17.1693 20.7595 17.0682C21.2063 16.2965 21.549 15.4689 21.7785 14.6072C21.8087 14.4937 21.8118 14.3746 21.7876 14.2597C21.7633 14.1447 21.7124 14.037 21.6389 13.9454L20.2476 12.2025ZM18.7382 11.5932C18.7542 11.8642 18.7542 12.1359 18.7382 12.4069C18.7271 12.5925 18.7852 12.7756 18.9014 12.9207L20.2317 14.5829C20.079 15.068 19.8836 15.5386 19.6476 15.9891L17.5289 16.2291C17.3443 16.2496 17.174 16.3378 17.0507 16.4766C16.8703 16.6796 16.6781 16.8718 16.4751 17.0522C16.3363 17.1755 16.2481 17.3458 16.2276 17.5304L15.9923 19.6472C15.5418 19.8833 15.0712 20.0788 14.586 20.2313L12.9229 18.901C12.7898 18.7946 12.6245 18.7368 12.4542 18.7369H12.4092C12.1381 18.7529 11.8664 18.7529 11.5954 18.7369C11.4099 18.7263 11.227 18.7844 11.0817 18.9L9.41479 20.2313C8.92966 20.0786 8.45906 19.8832 8.00854 19.6472L7.76854 17.5313C7.74806 17.3468 7.65987 17.1764 7.52104 17.0532C7.31808 16.8727 7.12587 16.6805 6.94541 16.4775C6.82216 16.3387 6.6518 16.2505 6.46729 16.23L4.35041 15.9938C4.11434 15.5433 3.91888 15.0727 3.76635 14.5875L5.09666 12.9244C5.21283 12.7793 5.27096 12.5962 5.25979 12.4107C5.24385 12.1397 5.24385 11.8679 5.25979 11.5969C5.27096 11.4114 5.21283 11.2283 5.09666 11.0832L3.76635 9.41723C3.919 8.93211 4.11446 8.4615 4.35041 8.01098L6.46635 7.77098C6.65087 7.7505 6.82123 7.66231 6.94448 7.52348C7.12494 7.32052 7.31714 7.12832 7.5201 6.94786C7.65949 6.82452 7.74804 6.65377 7.76854 6.46879L8.00385 4.35286C8.45432 4.11679 8.92493 3.92132 9.4101 3.76879L11.0732 5.09911C11.2183 5.21527 11.4014 5.2734 11.587 5.26223C11.858 5.24629 12.1297 5.24629 12.4007 5.26223C12.5862 5.27286 12.7691 5.21479 12.9145 5.09911L14.5804 3.76879C15.0655 3.92144 15.5361 4.1169 15.9867 4.35286L16.2267 6.46879C16.2471 6.65331 16.3353 6.82367 16.4742 6.94692C16.6771 7.12738 16.8693 7.31958 17.0498 7.52254C17.173 7.66137 17.3434 7.74956 17.5279 7.77004L19.6448 8.00536C19.8809 8.45583 20.0763 8.92644 20.2289 9.41161L18.8985 11.0747C18.7813 11.2211 18.7231 11.406 18.7354 11.5932H18.7382Z" fill="black" />
    </svg>
  );
}

function BizTypeShopIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.2" d="M21 6L19.86 12.2681C19.7972 12.6137 19.6151 12.9264 19.3454 13.1515C19.0758 13.3766 18.7357 13.4999 18.3844 13.5H6.61406L5.25 6H21Z" fill="black" fillOpacity="0.6" />
      <path d="M21.5756 5.51906C21.5052 5.43481 21.4172 5.36705 21.3177 5.32056C21.2183 5.27407 21.1098 5.24998 21 5.25H5.87625L5.30625 2.11594C5.27485 1.94313 5.1838 1.78681 5.04897 1.67425C4.91414 1.56169 4.74408 1.50003 4.56844 1.5H2.25C2.05109 1.5 1.86032 1.57902 1.71967 1.71967C1.57902 1.86032 1.5 2.05109 1.5 2.25C1.5 2.44891 1.57902 2.63968 1.71967 2.78033C1.86032 2.92098 2.05109 3 2.25 3H3.9375L6.33375 16.1522C6.40434 16.5422 6.57671 16.9067 6.83344 17.2087C6.47911 17.5397 6.22336 17.9623 6.09455 18.4298C5.96575 18.8972 5.96892 19.3912 6.10371 19.8569C6.23851 20.3226 6.49966 20.7419 6.85821 21.0683C7.21676 21.3947 7.6587 21.6154 8.13502 21.7059C8.61134 21.7965 9.10344 21.7533 9.55673 21.5813C10.01 21.4092 10.4068 21.115 10.7031 20.7312C10.9994 20.3474 11.1836 19.889 11.2353 19.407C11.287 18.9249 11.2041 18.4379 10.9959 18H15.2541C15.0863 18.3513 14.9995 18.7357 15 19.125C15 19.6442 15.154 20.1517 15.4424 20.5834C15.7308 21.0151 16.1408 21.3515 16.6205 21.5502C17.1001 21.7489 17.6279 21.8008 18.1371 21.6996C18.6463 21.5983 19.114 21.3483 19.4812 20.9812C19.8483 20.614 20.0983 20.1463 20.1996 19.6371C20.3008 19.1279 20.2489 18.6001 20.0502 18.1205C19.8515 17.6408 19.5151 17.2308 19.0834 16.9424C18.6517 16.654 18.1442 16.5 17.625 16.5H8.54719C8.37155 16.5 8.20149 16.4383 8.06665 16.3257C7.93182 16.2132 7.84077 16.0569 7.80938 15.8841L7.51219 14.25H18.3872C18.9141 14.2499 19.4243 14.0649 19.8288 13.7272C20.2333 13.3896 20.5064 12.9206 20.6006 12.4022L21.7406 6.13406C21.7599 6.02572 21.7551 5.91447 21.7266 5.80818C21.6981 5.7019 21.6466 5.60319 21.5756 5.51906ZM9.75 19.125C9.75 19.3475 9.68402 19.565 9.5604 19.75C9.43679 19.935 9.26109 20.0792 9.05552 20.1644C8.84995 20.2495 8.62375 20.2718 8.40552 20.2284C8.18729 20.185 7.98684 20.0778 7.8295 19.9205C7.67217 19.7632 7.56502 19.5627 7.52162 19.3445C7.47821 19.1262 7.50049 18.9 7.58564 18.6945C7.67078 18.4889 7.81498 18.3132 7.99998 18.1896C8.18499 18.066 8.4025 18 8.625 18C8.92337 18 9.20952 18.1185 9.4205 18.3295C9.63147 18.5405 9.75 18.8266 9.75 19.125ZM18.75 19.125C18.75 19.3475 18.684 19.565 18.5604 19.75C18.4368 19.935 18.2611 20.0792 18.0555 20.1644C17.85 20.2495 17.6238 20.2718 17.4055 20.2284C17.1873 20.185 16.9868 20.0778 16.8295 19.9205C16.6722 19.7632 16.565 19.5627 16.5216 19.3445C16.4782 19.1262 16.5005 18.9 16.5856 18.6945C16.6708 18.4889 16.815 18.3132 17 18.1896C17.185 18.066 17.4025 18 17.625 18C17.9234 18 18.2095 18.1185 18.4205 18.3295C18.6315 18.5405 18.75 18.8266 18.75 19.125ZM19.125 12.1341C19.0935 12.3073 19.0021 12.464 18.8666 12.5766C18.7312 12.6893 18.5605 12.7506 18.3844 12.75H7.23938L6.14906 6.75H20.1009L19.125 12.1341Z" fill="black" fillOpacity="0.6" />
    </svg>
  );
}

function BizTypeDetailerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M17.9671 13.8001H6.03906L7.17516 10.8856C7.35069 10.4354 7.65803 10.0487 8.05696 9.77601C8.4559 9.50335 8.92785 9.35745 9.41106 9.35742H14.5951C15.0783 9.35745 15.5502 9.50335 15.9492 9.77601C16.3481 10.0487 16.6554 10.4354 16.831 10.8856L17.9671 13.8001Z" fill="#56CCF2" />
      <path fillRule="evenodd" clipRule="evenodd" d="M5.10156 19.1621V20.8112C5.10156 20.9703 5.16478 21.123 5.2773 21.2355C5.38982 21.348 5.54243 21.4112 5.70156 21.4112H7.50156C7.66069 21.4112 7.8133 21.348 7.92583 21.2355C8.03835 21.123 8.10156 20.9703 8.10156 20.8112V19.1999H5.40156C5.29776 19.1995 5.19776 19.1869 5.10156 19.1621ZM15.9016 19.1999V20.8112C15.9016 20.9703 15.9648 21.123 16.0773 21.2355C16.1898 21.348 16.3424 21.4112 16.5016 21.4112H18.3016C18.4607 21.4112 18.6133 21.348 18.7258 21.2355C18.8383 21.123 18.9016 20.9703 18.9016 20.8112V19.1621C18.8054 19.1869 18.7054 19.1995 18.6016 19.1999H15.9016Z" fill="black" fillOpacity="0.4" />
      <path d="M4.20312 16.2003C4.20312 15.5638 4.45598 14.9533 4.90607 14.5032C5.35616 14.0531 5.96661 13.8003 6.60313 13.8003H17.4031C18.0396 13.8003 18.6501 14.0531 19.1002 14.5032C19.5503 14.9533 19.8031 15.5638 19.8031 16.2003V18.0003C19.8031 18.3186 19.6767 18.6238 19.4517 18.8488C19.2266 19.0739 18.9214 19.2003 18.6031 19.2003H5.40313C5.08487 19.2003 4.77964 19.0739 4.5546 18.8488C4.32955 18.6238 4.20313 18.3186 4.20312 18.0003V16.2003Z" fill="black" fillOpacity="0.5" />
      <path d="M8.10469 16.6114C8.10469 16.1144 7.70174 15.7114 7.20469 15.7114C6.70763 15.7114 6.30469 16.1144 6.30469 16.6114C6.30469 17.1085 6.70763 17.5114 7.20469 17.5114C7.70174 17.5114 8.10469 17.1085 8.10469 16.6114Z" fill="#F2C94C" />
      <path d="M15.9031 16.6114C15.9031 16.1144 16.3061 15.7114 16.8031 15.7114C17.3002 15.7114 17.7031 16.1144 17.7031 16.6114C17.7031 17.1085 17.3002 17.5114 16.8031 17.5114C16.3061 17.5114 15.9031 17.1085 15.9031 16.6114Z" fill="#F2C94C" />
      <path d="M6.38352 2.89271C6.4029 2.84988 6.43422 2.81355 6.47373 2.78806C6.51324 2.76258 6.55925 2.74902 6.60627 2.74902C6.65328 2.74902 6.6993 2.76258 6.7388 2.78806C6.77831 2.81355 6.80963 2.84988 6.82902 2.89271L6.97152 3.20861C7.08152 3.45161 7.20852 3.68541 7.35252 3.91001L7.75872 4.54421C7.8562 4.6964 7.91918 4.86807 7.94324 5.04719C7.96731 5.22631 7.95186 5.40853 7.898 5.58104C7.84414 5.75355 7.75316 5.91218 7.63145 6.04579C7.50975 6.17939 7.36027 6.28473 7.19352 6.35441L7.13892 6.37751C6.97016 6.44814 6.78905 6.48452 6.60612 6.48452C6.42318 6.48452 6.24207 6.44814 6.07332 6.37751L6.01872 6.35471C5.85192 6.28504 5.7024 6.17969 5.58066 6.04606C5.45893 5.91244 5.36793 5.75377 5.31406 5.58122C5.2602 5.40867 5.24477 5.22641 5.26886 5.04726C5.29295 4.86811 5.35598 4.69641 5.45352 4.54421L5.86002 3.91001C6.00402 3.68521 6.13092 3.45141 6.24072 3.20861L6.38352 2.89271ZM11.7835 2.89271C11.8029 2.84997 11.8343 2.81372 11.8737 2.78829C11.9132 2.76287 11.9592 2.74935 12.0061 2.74935C12.0531 2.74935 12.099 2.76287 12.1385 2.78829C12.178 2.81372 12.2093 2.84997 12.2287 2.89271L12.3715 3.20861C12.4815 3.45161 12.6085 3.68541 12.7525 3.91001L13.1587 4.54421C13.2562 4.6964 13.3192 4.86807 13.3432 5.04719C13.3673 5.22631 13.3519 5.40853 13.298 5.58104C13.2441 5.75355 13.1532 5.91218 13.0315 6.04579C12.9097 6.17939 12.7603 6.28473 12.5935 6.35441L12.5389 6.37751C12.3702 6.44814 12.1891 6.48452 12.0061 6.48452C11.8232 6.48452 11.6421 6.44814 11.4733 6.37751L11.4187 6.35471C11.2519 6.28504 11.1024 6.17969 10.9807 6.04606C10.8589 5.91244 10.7679 5.75377 10.7141 5.58122C10.6602 5.40867 10.6448 5.22641 10.6689 5.04726C10.6929 4.86811 10.756 4.69641 10.8535 4.54421L11.26 3.91001C11.404 3.68521 11.5309 3.45141 11.6407 3.20861L11.7835 2.89271ZM17.1835 2.89271C17.2029 2.84997 17.2343 2.81372 17.2737 2.78829C17.3132 2.76287 17.3592 2.74935 17.4061 2.74935C17.4531 2.74935 17.499 2.76287 17.5385 2.78829C17.578 2.81372 17.6093 2.84997 17.6287 2.89271L17.7715 3.20861C17.8815 3.45161 18.0085 3.68541 18.1525 3.91001L18.5587 4.54421C18.6562 4.6964 18.7192 4.86807 18.7432 5.04719C18.7673 5.22631 18.7519 5.40853 18.698 5.58104C18.6441 5.75355 18.5532 5.91218 18.4315 6.04579C18.3097 6.17939 18.1603 6.28473 17.9935 6.35441L17.9389 6.37751C17.7702 6.44814 17.5891 6.48452 17.4061 6.48452C17.2232 6.48452 17.0421 6.44814 16.8733 6.37751L16.8187 6.35471C16.6519 6.28504 16.5024 6.17969 16.3807 6.04606C16.2589 5.91244 16.1679 5.75377 16.1141 5.58122C16.0602 5.40867 16.0448 5.22641 16.0689 5.04726C16.093 4.86811 16.156 4.69641 16.2535 4.54421L16.66 3.91001C16.804 3.68521 16.9309 3.45141 17.0407 3.20861L17.1835 2.89271Z" fill="#2F80ED" />
    </svg>
  );
}

function BizTypeFuelIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.9453 11.7542C16.3253 14.6886 20.6547 17.9304 21.0222 19.7736C21.2734 21.0298 20.3978 22.0723 19.2991 21.8736C18.0616 21.6504 18.0034 19.8692 18.4909 18.5004C19.7172 15.0542 20.1391 13.0648 19.7153 11.1973L19.5128 10.3198" stroke="#616161" strokeWidth="0.9375" strokeMiterlimit="10" />
      <path d="M15.1541 10.5188C14.8035 10.5188 14.9404 10.2169 14.9404 9.84381V4.86006C14.9404 4.48693 14.8035 4.18506 15.1541 4.18506C15.5047 4.18506 16.1141 4.39318 16.1141 4.86006V9.84381C16.1141 10.2169 15.5047 10.5188 15.1541 10.5188Z" fill="#82AEC0" />
      <path d="M15.3941 21.3619V5.2425C15.3941 2.76187 13.3822 0.75 10.9016 0.75H6.55531C4.07281 0.75 2.06281 2.76187 2.06281 5.2425V21.3619C1.44406 21.5438 0.992188 22.1156 0.992188 22.7925V22.8488C0.992188 23.07 1.17219 23.25 1.39344 23.25H16.0634C16.2847 23.25 16.4647 23.07 16.4647 22.8488V22.7925C16.4648 22.4704 16.3605 22.1569 16.1675 21.899C15.9745 21.6411 15.7031 21.4526 15.3941 21.3619Z" fill="black" fillOpacity="0.5" />
      <path d="M12.3128 10.6071H5.04719C4.71531 10.6071 4.44531 10.3371 4.44531 10.0052V4.20393C4.44531 3.87205 4.71531 3.60205 5.04719 3.60205H12.3128C12.6447 3.60205 12.9147 3.87205 12.9147 4.20393V10.0033C12.9149 10.0825 12.8995 10.161 12.8694 10.2342C12.8393 10.3074 12.795 10.374 12.7391 10.4301C12.6832 10.4862 12.6167 10.5307 12.5436 10.5611C12.4704 10.5914 12.392 10.6071 12.3128 10.6071Z" fill="white" />
      <path d="M6.03906 5.5498H11.5347V6.9823H6.03906V5.5498ZM6.03906 7.7548H11.5347V9.1873H6.03906V7.7548Z" fill="#9E9E9E" />
      <path d="M4.52572 8.81248C4.51634 8.90998 4.37384 8.90998 4.36447 8.81436C4.22572 7.45123 4.14697 6.08623 4.08697 4.72311C3.99884 3.96936 4.58009 3.31873 5.35822 3.37123C7.56884 3.30561 9.79072 3.30561 12.0013 3.36936C12.7776 3.31686 13.3645 3.96748 13.2745 4.72123C13.2145 6.08623 13.1338 7.45311 12.9951 8.81811C12.9857 8.91561 12.8432 8.91561 12.8338 8.81811C12.6895 7.40623 12.6107 5.99248 12.547 4.58248C12.5446 4.5538 12.5389 4.52549 12.5301 4.49811C12.4832 4.32936 12.3201 4.18873 12.1513 4.20561C12.0613 4.20936 5.29259 4.20748 5.20634 4.20373C5.03759 4.18686 4.87447 4.32748 4.82759 4.49811C4.82009 4.52623 4.81447 4.55436 4.81072 4.58248C4.74697 5.99061 4.67009 7.40248 4.52572 8.81248Z" fill="#82AEC0" />
      <path d="M8.67938 19.1194C10.418 19.1194 11.8275 17.6176 11.8275 15.765C11.8275 13.9124 10.418 12.4106 8.67938 12.4106C6.94071 12.4106 5.53125 13.9124 5.53125 15.765C5.53125 17.6176 6.94071 19.1194 8.67938 19.1194Z" fill="#F5F5F5" />
      <path d="M7.28906 16.2377C7.28906 15.4183 8.68219 13.8096 8.68219 13.8096C8.68219 13.8096 10.0753 15.4183 10.0753 16.2377C10.0753 17.0571 9.45094 17.7227 8.68219 17.7227C7.91344 17.7227 7.28906 17.0571 7.28906 16.2377Z" fill="#212121" />
      <path d="M2.0625 20.6309H15.3937V21.3602H2.0625V20.6309Z" fill="#D6F26B" />
      <path d="M3.27344 4.13252C3.43844 3.20252 4.24844 2.05127 5.92281 2.05127" stroke="#D6F26B" strokeWidth="0.78125" strokeMiterlimit="10" strokeLinecap="round" />
      <path d="M20.2578 11.0589L19.1711 11.3349L18.992 10.6299L20.0786 10.3537L20.2578 11.0589ZM19.6409 5.59698L20.9028 3.30948C20.9966 3.14073 21.1203 2.99073 21.2684 2.86886C21.7297 2.49011 22.7628 1.63511 22.9803 1.39886C23.2634 1.09136 22.7384 0.442606 22.3653 0.699481C22.0728 0.901981 20.9966 1.84698 20.5484 2.24261C20.4172 2.35698 20.3084 2.49386 20.2241 2.64761L18.8984 5.05136L19.6409 5.59698Z" fill="#9E9E9E" />
      <path d="M18.8738 7.07439L20.64 6.70877L21.2625 8.92502C21.3619 9.31502 21.1819 9.42752 20.8369 9.51565L19.5881 9.86252M18.6094 6.9994L20.1188 10.44L21.5475 10.0406C22.1456 9.86627 22.1288 9.37877 22.0369 9.0169L21.3 6.31689L18.6094 6.9994Z" fill="#757575" />
      <path d="M19.4686 3.96004L20.3818 4.47379C20.5036 4.54129 20.5486 4.69317 20.4868 4.81692L20.3049 5.18067L20.7268 5.49942C21.0209 5.72086 21.2301 6.03659 21.3193 6.39379L21.3699 6.59067L20.0649 6.92629C19.9335 6.96108 19.8213 7.04652 19.7527 7.1639C19.6842 7.28127 19.665 7.42102 19.6993 7.55254L20.3011 9.92067C20.3611 10.1757 20.3761 10.3857 20.1193 10.4419L19.0786 10.7007C18.8311 10.755 18.5855 10.6032 18.5236 10.3575L17.7961 7.49067C17.4699 6.20629 17.9724 5.77129 18.0774 5.55942C18.1824 5.34754 18.7336 4.77004 18.7336 4.77004L19.1105 4.06504C19.1799 3.93567 19.3411 3.88879 19.4686 3.96004Z" fill="black" fillOpacity="0.5" />
      <path d="M20.0228 5.50111L19.1172 5.04736" stroke="#D6F26B" strokeWidth="0.625" strokeMiterlimit="10" strokeLinecap="round" />
    </svg>
  );
}

function BizBackArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.5005 9.99986C17.5005 10.1656 17.4346 10.3246 17.3174 10.4418C17.2002 10.559 17.0413 10.6249 16.8755 10.6249H4.63409L9.19268 15.1827C9.25075 15.2407 9.29681 15.3097 9.32824 15.3855C9.35966 15.4614 9.37584 15.5427 9.37584 15.6249C9.37584 15.707 9.35966 15.7883 9.32824 15.8642C9.29681 15.94 9.25075 16.009 9.19268 16.067C9.13461 16.1251 9.06567 16.1712 8.9898 16.2026C8.91393 16.234 8.83261 16.2502 8.75049 16.2502C8.66837 16.2502 8.58705 16.234 8.51118 16.2026C8.43531 16.1712 8.36637 16.1251 8.3083 16.067L2.6833 10.442C2.62519 10.384 2.57909 10.3151 2.54764 10.2392C2.51619 10.1633 2.5 10.082 2.5 9.99986C2.5 9.91772 2.51619 9.8364 2.54764 9.76052C2.57909 9.68465 2.62519 9.61572 2.6833 9.55767L8.3083 3.93267C8.42558 3.8154 8.58464 3.74951 8.75049 3.74951C8.91634 3.74951 9.0754 3.8154 9.19268 3.93267C9.30995 4.04995 9.37584 4.20901 9.37584 4.37486C9.37584 4.54071 9.30995 4.69977 9.19268 4.81705L4.63409 9.37486H16.8755C17.0413 9.37486 17.2002 9.44071 17.3174 9.55792C17.4346 9.67513 17.5005 9.8341 17.5005 9.99986Z" fill="black" />
    </svg>
  );
}

function BizClearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.33464 15.8334L4.16797 14.6667L8.83464 10.0001L4.16797 5.33341L5.33464 4.16675L10.0013 8.83341L14.668 4.16675L15.8346 5.33341L11.168 10.0001L15.8346 14.6667L14.668 15.8334L10.0013 11.1667L5.33464 15.8334Z" fill="black" fillOpacity="0.6" />
    </svg>
  );
}

function BusinessTypeIcon({ type }) {
  if (type.icon === 'shop') return <BizTypeShopIcon />;
  if (type.icon === 'detailer') return <BizTypeDetailerIcon />;
  if (type.icon === 'fuel') return <BizTypeFuelIcon />;
  return <BizTypeGearIcon />;
}

function MechanicModal({ close, submit, initialData, onFinish }) {
  const initialType = useMemo(() => {
    if (!initialData) return 'mechanic';
    if (initialData.specialty === 'Fuel Station') return 'fuel';
    if (initialData.specialty === 'Car Detailing') return 'detailer';
    if (['Shop', 'Parts Shop', 'Auto Parts', 'Car Parts'].includes(initialData.specialty)) return 'shop';
    return 'mechanic';
  }, [initialData]);
  const [step, setStep] = useState(initialData ? 'info' : 'type');
  const [businessType, setBusinessType] = useState(initialType);
  const [name, setName] = useState(initialData?.name || '');
  const [area, setArea] = useState(initialData?.area || initialData?.locationDetail || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [openingDays, setOpeningDays] = useState(initialData?.openingDays || '');
  const [operatingTime, setOperatingTime] = useState(initialData?.operatingTime || '');
  const [about, setAbout] = useState(initialData?.about || '');
  const [selectedSpecialties, setSelectedSpecialties] = useState(initialData?.specialties || []);
  const [saving, setSaving] = useState(false);
  
  // For coordinates
  const [lat, setLat] = useState(initialData?.lat || 5.6037);
  const [lng, setLng] = useState(initialData?.lng || -0.1870);
  const [locationSearchFocused, setLocationSearchFocused] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [flyToTrigger, setFlyToTrigger] = useState(0);
  const [specialtySearchActive, setSpecialtySearchActive] = useState(false);
  const [specialtySearchQuery, setSpecialtySearchQuery] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const hasSetDefaultLocationRef = useRef(false);
  const locationSearchRequestIdRef = useRef(0);
  const typeConfig = BUSINESS_TYPES[businessType];
  const hasSpecialties = typeConfig.specialties.length > 0;

  const canContinue =
    step === 'info' ? Boolean(name.trim() && phone.trim() && openingDays && operatingTime) :
    step === 'location' ? Boolean(area.trim()) :
    true;

  // Default the pin to the owner's actual current location (instead of a
  // fixed Accra fallback) the first time they reach this step for a new
  // listing — editing an existing one keeps its saved location untouched.
  useEffect(() => {
    if (step !== 'location' || initialData || hasSetDefaultLocationRef.current) return;
    if (!('geolocation' in navigator)) return;
    hasSetDefaultLocationRef.current = true;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        setFlyToTrigger(Date.now());
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          const shortLabel = formatShortLocation(data?.address, data?.display_name);
          if (shortLabel) setArea(shortLabel);
        } catch {
          // Reverse geocoding failed — pin still moves, just no label yet.
        }
      },
      () => {
        // Permission denied or unavailable — keep the default coordinates.
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [step, initialData]);

  // Live search suggestions as the owner types in the location search field.
  useEffect(() => {
    if (!locationSearchFocused || area.trim().length < 2) {
      setLocationSuggestions([]);
      return;
    }
    const requestId = ++locationSearchRequestIdRef.current;
    const handle = setTimeout(async () => {
      try {
        const q = encodeURIComponent(area.trim());
        // Soft-bias results toward the current pin (bounded=0 nudges
        // ranking rather than excluding anything outside the box), so
        // typing "Osu" near Accra doesn't surface some other country's Osu.
        const delta = 1.5;
        const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${q}&countrycodes=gh&viewbox=${viewbox}&bounded=0&limit=5`,
        );
        const data = await res.json();
        if (locationSearchRequestIdRef.current !== requestId) return; // a newer keystroke already superseded this response
        setLocationSuggestions(
          Array.isArray(data)
            ? data.map((d) => ({
                label: formatShortLocation(d.address, d.display_name),
                lat: parseFloat(d.lat),
                lng: parseFloat(d.lon),
              }))
            : [],
        );
      } catch {
        if (locationSearchRequestIdRef.current === requestId) setLocationSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [area, locationSearchFocused]);

  const pickLocationSuggestion = (s) => {
    setArea(s.label);
    setLat(s.lat);
    setLng(s.lng);
    setLocationSuggestions([]);
    setLocationSearchFocused(false);
    setFlyToTrigger(Date.now());
  };

  const goBack = () => {
    if (step === 'type') return close();
    if (step === 'info') return initialData ? close() : setStep('type');
    if (step === 'location') return setStep('info');
    setStep('location');
  };

  const chooseType = (nextType) => {
    setBusinessType(nextType);
    setSelectedSpecialties([]);
    setSpecialtySearchActive(false);
    setSpecialtySearchQuery('');
  };

  const toggleSpecialty = (item) => {
    setSelectedSpecialties((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
    );
  };

  const buildListing = () => ({
    name: name.trim(),
    area: area.trim(),
    locationDetail: area.trim(),
    phone: phone.trim(),
    openingDays,
    operatingTime,
    about: about.trim(),
    specialty: typeConfig.category,
    specialties: hasSpecialties ? selectedSpecialties : [],
    lat,
    lng,
  });

  const saveListing = async () => {
    setSaving(true);
    try {
      await submit(buildListing(), initialData);
      if (!initialData) setShowSuccess(true);
    } finally {
      setSaving(false);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    if (step === 'type') {
      setStep('info');
      return;
    }
    if (step === 'info') {
      setStep('location');
      return;
    }
    if (step === 'location' && hasSpecialties) {
      setStep('specialties');
      return;
    }
    await saveListing();
  };


  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <form className={`business-flow business-flow--${step}`} onSubmit={send}>
        {step === 'location' ? (
          <div className="business-location-topbar">
            <div className="business-location-topbar-row">
              {!locationSearchFocused && (
                <button type="button" className="business-back-btn" onClick={goBack} aria-label="Go back">
                  <BizBackArrowIcon />
                </button>
              )}
              <div className="business-location-search-pill">
                <MagnifyingGlass size={18} color="rgba(0,0,0,0.6)" />
                <input
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  onFocus={() => setLocationSearchFocused(true)}
                  onBlur={() => setTimeout(() => setLocationSearchFocused(false), 150)}
                  placeholder="Search Your Business Location"
                />
                {area && (
                  <button
                    type="button"
                    className="business-location-clear-btn"
                    aria-label="Clear location search"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setArea(''); setLocationSuggestions([]); }}
                  >
                    <BizClearIcon />
                  </button>
                )}
              </div>
              {locationSearchFocused && locationSuggestions.length > 0 && (
                <div className="business-location-suggestions">
                  {locationSuggestions.slice(0, 5).map((s, i) => (
                    <button
                      type="button"
                      key={i}
                      className="business-location-suggestion"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickLocationSuggestion(s)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="business-location-hint">{typeConfig.locationHint}</p>
          </div>
        ) : step === 'specialties' && specialtySearchActive ? (
          <header className="business-flow-header business-flow-header--search-active">
            <div className="business-location-search-pill">
              <MagnifyingGlass size={18} color="rgba(0,0,0,0.6)" />
              <input
                autoFocus
                value={specialtySearchQuery}
                onChange={(e) => setSpecialtySearchQuery(e.target.value)}
                placeholder="Search specialities"
              />
              {specialtySearchQuery && (
                <button
                  type="button"
                  className="business-location-clear-btn"
                  aria-label="Clear speciality search"
                  onClick={() => setSpecialtySearchQuery('')}
                >
                  <BizClearIcon />
                </button>
              )}
            </div>
            <button
              type="button"
              className="business-search-btn"
              onClick={() => { setSpecialtySearchActive(false); setSpecialtySearchQuery(''); }}
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </header>
        ) : (
          <header className="business-flow-header">
            <button type="button" className="business-back-btn" onClick={goBack} aria-label="Go back">
              <BizBackArrowIcon />
            </button>
            <h2>
              {step === 'type' && 'Select Business Type'}
              {step === 'info' && 'Business Info'}
              {step === 'specialties' && 'Your Specialities'}
            </h2>
            {step === 'specialties' ? (
              <button
                type="button"
                className="business-search-btn"
                onClick={() => setSpecialtySearchActive(true)}
                aria-label="Search specialities"
              >
                <MagnifyingGlass size={18} />
              </button>
            ) : (
              <button type="button" className="business-close-btn" onClick={close} aria-label="Close">
                <X size={16} />
              </button>
            )}
          </header>
        )}

        <div className={`business-flow-body ${step === 'location' ? 'business-flow-body--map' : ''}`}>
          {step === 'type' && (
            <div className="business-type-list">
              {Object.entries(BUSINESS_TYPES).map(([key, item]) => (
                <button
                  type="button"
                  key={key}
                  className={`business-type-card ${businessType === key ? 'selected' : ''}`}
                  onClick={() => chooseType(key)}
                >
                  <span className="business-type-icon"><BusinessTypeIcon type={item} /></span>
                  <span className="business-type-copy">
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  <span className="business-type-radio" aria-hidden="true"></span>
                </button>
              ))}
            </div>
          )}

          {step === 'info' && (
            <div
              className="business-fields"
              onFocus={(e) => {
                if (!e.target.matches('input, select, textarea')) return;
                const field = e.target;
                // The browser's own "scroll focused field into view" is
                // unreliable inside this fixed, keyboard-reactive sheet —
                // do it ourselves. The delay lets the keyboard's open
                // animation (and the --vh/height update that follows it)
                // finish first, so the scroll target is computed against
                // the final, keyboard-shrunk layout instead of a stale one.
                setTimeout(() => {
                  field.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }, 300);
              }}
            >
              <label>{typeConfig.nameLabel}
                <input id="add-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder={typeConfig.namePlaceholder} />
              </label>
              <label>Business Contact
                <input id="add-phone" required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+233 24 000 0000" />
              </label>
              <label>Opening Days
                <select required value={openingDays} onChange={(e) => setOpeningDays(e.target.value)}>
                  <option value="" disabled>Select opening days</option>
                  <option value="Monday - Friday">Monday - Friday</option>
                  <option value="Monday - Saturday">Monday - Saturday</option>
                  <option value="Every day">Every day</option>
                  <option value="Weekends only">Weekends only</option>
                </select>
              </label>
              <label>Operating Time
                <select required value={operatingTime} onChange={(e) => setOperatingTime(e.target.value)}>
                  <option value="" disabled>Select operating time</option>
                  <option value="8:00 AM - 5:00 PM">8:00 AM - 5:00 PM</option>
                  <option value="7:00 AM - 6:00 PM">7:00 AM - 6:00 PM</option>
                  <option value="24 hours">24 hours</option>
                  <option value="By appointment">By appointment</option>
                </select>
              </label>
              <label>About Your Business <span>{about.length} / 150</span>
                <textarea maxLength={150} value={about} onChange={(e) => setAbout(e.target.value)} placeholder={typeConfig.aboutPlaceholder} />
              </label>
            </div>
          )}

          {step === 'location' && (
            <div className="business-map-shell">
              <MapContainer center={[lat, lng]} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer
                  attribution={BIZ_TILE_ATTRIBUTION}
                  url={BIZ_TILE_URL}
                  subdomains={BIZ_TILE_SUBDOMAINS}
                  maxNativeZoom={18}
                  maxZoom={20}
                />
                <LocationPicker
                  lat={lat}
                  lng={lng}
                  setLat={setLat}
                  setLng={setLng}
                  category={typeConfig.category}
                  label={name || typeConfig.shortTitle}
                  onInteract={() => setLocationSearchFocused(false)}
                />
                <MapFlyTo lat={lat} lng={lng} trigger={flyToTrigger} />
              </MapContainer>
            </div>
          )}

          {step === 'specialties' && (
            <div className="business-specialties-step">
              <p>{typeConfig.specialtiesIntro}</p>
              {(() => {
                const filteredSpecialties = typeConfig.specialties.filter((item) =>
                  item.toLowerCase().includes(specialtySearchQuery.trim().toLowerCase()),
                );
                if (filteredSpecialties.length === 0) {
                  return <p className="business-specialty-empty">No specialities match "{specialtySearchQuery}".</p>;
                }
                return (
                  <div className="business-specialty-grid">
                    {filteredSpecialties.map((item) => (
                      <button
                        type="button"
                        key={item}
                        className={`business-specialty-chip ${selectedSpecialties.includes(item) ? 'selected' : ''}`}
                        onClick={() => toggleSpecialty(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {step === 'location' && !locationSearchFocused && (
          <div className="business-selected-location">
            <small>Location</small>
            <strong>{area || 'Selected location'}</strong>
          </div>
        )}

        {!(step === 'location' && locationSearchFocused) && (
          <button
            id="btn-submit-mechanic"
            className={`business-continue-btn ${!canContinue ? 'business-continue-btn--incomplete' : ''}`}
            disabled={saving || !canContinue}
          >
            {saving ? 'Saving...' : step === 'specialties' || (step === 'location' && !hasSpecialties) ? 'Finish Setup' : 'Continue'}
          </button>
        )}
      </form>

      {/* Layered on top of the still-mounted wizard (dimmed behind it) rather
          than replacing it, so this shows over whatever step the owner was
          on — not whatever happens to be behind the whole modal. Tier 2 here
          matches "Profile Claimed": self-onboarded listings are claimed but
          not yet independently confirmed by Gears staff. */}
      {showSuccess && (
        <div className="verification-sheet-overlay">
          <div className="verification-sheet">
            <div className="biz-success-icon">
              <SealCheck size={44} weight="fill" color="var(--forest)" />
            </div>
            <h3 className="biz-success-title">{typeConfig.successTitle}</h3>
            <p className="biz-success-desc">
              You've earned our <strong>Tier 2</strong> badge.<br />
              Our Staff will contact you to complete your onboarding process.
            </p>
            <div className="verification-sheet-footer">
              <button className="verification-sheet-btn" onClick={onFinish}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function App() {
  const [allMechanics, setAllMechanics] = useState([]);
  const [searchedArea, setSearchedArea] = useState('');
  // Initialize synchronously so sidebar never flashes logged-out when session already exists
  const [user, setUser] = useState(() => (auth ? auth.currentUser : null));
  const [authReady, setAuthReady] = useState(() => !!(auth && auth.currentUser));
  const [modal, setModal] = useState(null); 
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedMechanic, setSelectedMechanic] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [savedMechanics, setSavedMechanics] = useState([]);
  const [viewMode, setViewMode] = useState('all');
  const [userLocation, setUserLocation] = useState(null);
  const [mapPanTrigger, setMapPanTrigger] = useState(0);
  const [isLocatingScan, setIsLocatingScan] = useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [routeTarget, setRouteTarget] = useState(null);
  const [recentInteractions, setRecentInteractions] = useState(loadRecentInteractions);
  const [businessDashboardOpen, setBusinessDashboardOpen] = useState(false);
  const [localBusinessOwnerId] = useState(() => {
    const existing = localStorage.getItem('gearsLocalBusinessOwnerId');
    if (existing) return existing;
    const next = `local-owner-${Date.now()}`;
    localStorage.setItem('gearsLocalBusinessOwnerId', next);
    return next;
  });
  const searchRef = useRef(null);
  const [pendingItemQuery, setPendingItemQuery] = useState(null);
  const deepLinkHandledRef = useRef(false);

  // Records the single most recent explicit action per mechanic (call,
  // bookmark, direction, rate) so cards can show "Called 2 min ago" etc.
  const recordInteraction = (mechanicId, action) => {
    setRecentInteractions((prev) => {
      const next = { ...prev, [mechanicId]: { action, timestamp: Date.now() } };
      saveRecentInteractions(next);
      return next;
    });
  };

  const handleShowDirection = (mechanic) => {
    if (!mechanic) { setRouteTarget(null); return; }
    if (mechanic.lat == null || mechanic.lng == null) return;
    setRouteTarget({ lat: mechanic.lat, lng: mechanic.lng });
  };

  const handleSelectMechanic = (mechanic) => {
    setSelectedMechanic(mechanic);
    const isDesktop = typeof window !== 'undefined' && window.innerWidth > 768;
    if (isDesktop && mechanic) {
      handleShowDirection(mechanic);
    } else {
      setRouteTarget(null);
    }
  };

  const handleCloseDetail = () => {
    setSelectedMechanic(null);
    setRouteTarget(null);
  };

  // Deep-link support: WhatsApp order messages carry a link back to
  // `?mechanic=<id>&item=<name>&type=<product|service|package>` so the
  // shop can tap through and see exactly what was requested.
  useEffect(() => {
    if (deepLinkHandledRef.current || !allMechanics.length) return;
    const params = new URLSearchParams(window.location.search);
    const mechanicId = params.get('mechanic');
    const itemName = params.get('item');
    if (mechanicId && itemName) {
      const target = allMechanics.find(m => m.id === mechanicId);
      if (target) {
        handleSelectMechanic(target);
        setPendingItemQuery({ name: itemName, type: params.get('type') || 'product' });
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
    deepLinkHandledRef.current = true;
  }, [allMechanics]);

  useEffect(() => {
    if (isDarkMode) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
  }, [isDarkMode]);

  useEffect(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) {
      setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 700);
      }, 1800);
    }
    
    // Start watching user location globally
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          // If this is the very first time we get location, trigger a pan
          setMapPanTrigger(prev => prev === 0 ? 1 : prev);
        },
        (err) => {
          console.warn("Location error:", err);
          // If they deny location or it fails, we just don't set it and use default Accra center
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Keep fixed mobile sheets/modals sized to the *real* visible viewport, so the
  // on-screen keyboard doesn't squish or reflow them like a browser tab — it should
  // just overlay, the way a native app's keyboard does. Also track how tall the
  // keyboard itself currently is (0 when it's down) as --keyboard-height, so a
  // scrollable list that sits under it can pad its bottom by that much — letting
  // rows that would otherwise be trapped behind the keyboard scroll up into view,
  // without the sheet itself resizing/squishing.
  useEffect(() => {
    const viewport = window.visualViewport;
    const setVh = () => {
      const height = viewport ? viewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--vh', `${height * 0.01}px`);
      const keyboardHeight = viewport ? Math.max(0, window.innerHeight - viewport.height) : 0;
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    };
    setVh();
    const target = viewport || window;
    target.addEventListener('resize', setVh);
    target.addEventListener('scroll', setVh);
    return () => {
      target.removeEventListener('resize', setVh);
      target.removeEventListener('scroll', setVh);
    };
  }, []);

  // Counter the *visual* viewport pan Safari/Chrome apply when a focused input
  // sits inside a `position:fixed` sheet (to "scroll" it above the keyboard).
  // That pan is a property of visualViewport.offsetLeft/Top, not a document
  // scroll — window.scrollTo(0,0) never touches it, which is why fixed sheets
  // could still visibly drift (including horizontally) while typing. Shifting
  // the whole app root by the exact inverse offset cancels the drift outright,
  // everywhere in the app, instead of chasing it sheet by sheet.
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.getElementById('root');
    if (!viewport || !root) return;
    const compensate = () => {
      root.style.transform = `translate(${-viewport.offsetLeft}px, ${-viewport.offsetTop}px)`;
    };
    compensate();
    viewport.addEventListener('resize', compensate);
    viewport.addEventListener('scroll', compensate);
    return () => {
      viewport.removeEventListener('resize', compensate);
      viewport.removeEventListener('scroll', compensate);
      root.style.transform = '';
    };
  }, []);

  // Separately from the visual-viewport pan above, iOS Safari can also nudge
  // the actual document scroll position (window.scrollY) to "reveal" a
  // focused input that sits low inside a fixed sheet — even with html/body
  // pinned to overflow:hidden. The app has no scrollable document (every
  // panel scrolls inside its own fixed container instead), so any drift here
  // is always this bug, never an intentional scroll; snap it back immediately
  // so a focused field can't drag the whole app down and expose the backdrop.
  useEffect(() => {
    const resetScroll = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    };
    window.addEventListener('scroll', resetScroll, { passive: true });
    return () => window.removeEventListener('scroll', resetScroll);
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setSavedMechanics(JSON.parse(localStorage.getItem('savedMechanics') || '[]'));
      return;
    }
    const fetchSaves = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const saves = snap.data().savedMechanics || [];
          setSavedMechanics(saves);
          localStorage.setItem('savedMechanics', JSON.stringify(saves));
        } else {
          // If no doc exists, use localStorage
          setSavedMechanics(JSON.parse(localStorage.getItem('savedMechanics') || '[]'));
        }
      } catch (e) {
        console.warn("Firestore read failed, falling back to localStorage", e);
        setSavedMechanics(JSON.parse(localStorage.getItem('savedMechanics') || '[]'));
      }
    };
    fetchSaves();
  }, [user]);

  useEffect(() => {
    if (!firebaseReady) {
      // No Firebase configured (e.g. local dev without .env) — use local mock
      // data instead so the app is still usable/testable. Remove this once
      // VITE_FIREBASE_* is set up locally.
      const mockData = mockExtrasData.map((m, i) => ({ id: `mock-${i}`, ...m }));
      setAllMechanics(mockData);
      setLoading(false);
      setAuthReady(true);
      return;
    }

    let unsubscribe = () => {};

    const init = async () => {
      // Step 1: check if user just came back from signInWithRedirect
      try {
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult?.user) {
          setUser(redirectResult.user);
          setAuthReady(true);
          setModal((current) => current === 'add' || current?.reason === 'business' ? 'add' : null);
        }
      } catch (e) {
        console.error('Redirect result error:', e);
        setNotice('Auth Error: ' + e.message.replace('Firebase: ', ''));
      }

      // Step 2: subscribe to ongoing auth changes (fires immediately with current user)
      unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthReady(true);
        if (u) setModal((current) => current === 'add' || current?.reason === 'business' ? 'add' : null);
      });

      // Step 3: load mechanics data
      try {
        const result = await getDocs(query(collection(db, 'mechanics'), limit(100)));
        setAllMechanics(result.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => unsubscribe();
  }, []);

  const mechanics = useMemo(() => {
    let list = allMechanics.map(m => {
      let distStr = null;
      let rawDist = Infinity;
      let timeInMinutes = null;
      if (userLocation && m.lat && m.lng) {
        rawDist = calculateDistance(userLocation.lat, userLocation.lng, m.lat, m.lng);
        timeInMinutes = (rawDist / 30) * 60;
        const rounded = Math.max(5, Math.round(timeInMinutes / 5) * 5);
        if (rounded >= 60) {
          const hrs = Math.floor(rounded / 60);
          const mins = rounded % 60;
          distStr = mins > 0 ? `${hrs} hr ${mins} min drive away` : `${hrs} hr drive away`;
        } else {
          distStr = rounded + ' min drive away';
        }
      }
      return { ...m, distance: distStr, _rawDist: timeInMinutes ?? Infinity, timeInMinutes };
    });

    if (viewMode === 'saved') {
      list = list.filter(m => savedMechanics.includes(m.id));
    } else if (viewMode === 'detailers') {
      list = list.filter(m => m.specialty === 'Car Detailing');
    } else if (viewMode === 'fuel') {
      list = list.filter(m => m.specialty === 'Fuel Station');
    } else if (viewMode === 'shop') {
      list = list.filter(m => ['Shop', 'Parts Shop', 'Auto Parts'].includes(m.specialty));
    }
    
    // Sort by distance if location available
    if (userLocation) {
      list.sort((a, b) => a._rawDist - b._rawDist);
    }

    if (!searchedArea) return list;
    const term = searchedArea.toLowerCase();
    return list.filter(
      (m) =>
        m.name?.toLowerCase().includes(term) ||
        m.area?.toLowerCase().includes(term) ||
        m.specialty?.toLowerCase().includes(term) ||
        m.locationDetail?.toLowerCase().includes(term) ||
        m.about?.toLowerCase().includes(term) ||
        m.phone?.toLowerCase().includes(term) ||
        (m.specialties || []).some(s => s.toLowerCase().includes(term)) ||
        (m.services || []).some(s => (typeof s === 'string' ? s : s.name)?.toLowerCase().includes(term)) ||
        (m.products || []).some(p => p.name?.toLowerCase().includes(term)) ||
        (m.fuelPrices || []).some(f => f.type?.toLowerCase().includes(term)) ||
        (m.facilities || []).some(f => f.toLowerCase?.().includes(term)),
    );
  }, [allMechanics, searchedArea, viewMode, savedMechanics, userLocation]);

  const show = (message) => { setNotice(message); setTimeout(() => setNotice(''), 3500); };

  // Which category page (viewMode) a mechanic belongs to.
  const categoryForMechanic = (m) => {
    if (m.specialty === 'Car Detailing') return 'detailers';
    if (m.specialty === 'Fuel Station') return 'fuel';
    if (['Shop', 'Parts Shop', 'Auto Parts', 'Car Parts'].includes(m.specialty)) return 'shop';
    return 'all';
  };

  // Does `term` match anything (name/specialty/services/etc — NOT area/location,
  // those are handled separately as a location search) within `category`?
  const categoryHasMatch = (term, category) =>
    allMechanics.some((m) => {
      if (categoryForMechanic(m) !== category) return false;
      return (
        m.name?.toLowerCase().includes(term) ||
        m.specialty?.toLowerCase().includes(term) ||
        m.about?.toLowerCase().includes(term) ||
        m.phone?.toLowerCase().includes(term) ||
        (m.specialties || []).some((s) => s.toLowerCase().includes(term)) ||
        (m.services || []).some((s) => (typeof s === 'string' ? s : s.name)?.toLowerCase().includes(term)) ||
        (m.products || []).some((p) => p.name?.toLowerCase().includes(term)) ||
        (m.fuelPrices || []).some((f) => f.type?.toLowerCase().includes(term)) ||
        (m.facilities || []).some((f) => f.toLowerCase?.().includes(term))
      );
    });

  // Applies a search term and, if it isn't a location search, jumps to
  // whichever category page actually has matches — so searching a detailer's
  // name from the mechanics home page (or a mechanic's name from the
  // detailers page, etc.) lands you on the results instead of "0 found".
  // Location searches ("Accra") never redirect — they filter within
  // whichever page the user is already on.
  const handleSmartSearch = (term) => {
    setSearchedArea(term);
    if (!term) return;

    const t = term.toLowerCase();
    const isLocationMatch = allMechanics.some(
      (m) => m.area?.toLowerCase().includes(t) || m.locationDetail?.toLowerCase().includes(t),
    );
    if (isLocationMatch) return;

    const currentCategory = ['detailers', 'fuel', 'shop'].includes(viewMode) ? viewMode : 'all';
    if (categoryHasMatch(t, currentCategory)) return;

    const target = ['detailers', 'fuel', 'shop', 'all'].find(
      (c) => c !== currentCategory && categoryHasMatch(t, c),
    );
    if (target) setViewMode(target);
  };

  const toggleSave = async (mechanic) => {
    if (!mechanic) return;
    const isSaved = savedMechanics.includes(mechanic.id);

    // Play a short beep on save/unsave
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = isSaved ? 600 : 900;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (_) { /* ignore audio errors */ }

    if (!user) {
      setModal({ type: 'auth', reason: 'bookmark' });
      return;
    }
    const userRef = doc(db, 'users', user.uid);
    try {
      let newSaves;
      if (isSaved) {
        await setDoc(userRef, { savedMechanics: arrayRemove(mechanic.id) }, { merge: true });
        newSaves = savedMechanics.filter(id => id !== mechanic.id);
        show('Removed from saved');
      } else {
        await setDoc(userRef, { savedMechanics: arrayUnion(mechanic.id) }, { merge: true });
        newSaves = [...savedMechanics, mechanic.id];
        show('Saved successfully');
      }
      setSavedMechanics(newSaves);
      localStorage.setItem('savedMechanics', JSON.stringify(newSaves));
    } catch (e) {
      console.warn('Firestore write failed, using localStorage', e);
      // Fallback to localStorage if Firestore rules deny write
      let newSaves;
      if (isSaved) {
        newSaves = savedMechanics.filter(id => id !== mechanic.id);
        show('Removed from saved (Local)');
      } else {
        newSaves = [...savedMechanics, mechanic.id];
        show('Saved successfully (Local)');
      }
      setSavedMechanics(newSaves);
      localStorage.setItem('savedMechanics', JSON.stringify(newSaves));
    }

    if (!isSaved) recordInteraction(mechanic.id, 'bookmark');
  };

  const submitMechanic = async (listing, existingData) => {
    const ownerId = user?.uid || localBusinessOwnerId;
    const useLocalBusiness = !user || !db || existingData?.id?.startsWith('local-business-');

    if (!useLocalBusiness && (!existingData || existingData.phone !== listing.phone)) {
      const q = query(collection(db, 'mechanics'), where('phone', '==', listing.phone));
      const snap = await getDocs(q);
      if (!snap.empty) {
        show('A business with this phone number already exists.');
        throw new Error('Duplicate phone');
      }
    }

    if (existingData) {
      if (!useLocalBusiness) {
        await updateDoc(doc(db, 'mechanics', existingData.id), listing);
      }
      setAllMechanics((prev) =>
        prev.map((m) => m.id === existingData.id ? { ...m, ...listing } : m)
      );
      show('Business updated!');
      setModal(null);
    } else {
      // Self-onboarded listings start "claimed" (verification tier 2) since
      // the owner set it up themselves but Gears hasn't confirmed it yet.
      const mechanic = { ...listing, specialty: listing.specialty || 'General repairs', rating: 'New', ratingCount: 0, ratingSum: 0, open: true, claimed: true };
      if (useLocalBusiness) {
        mechanic.id = `local-business-${Date.now()}`;
      } else {
        const ref = await addDoc(collection(db, 'mechanics'), {
          ...mechanic,
          createdBy: ownerId,
          createdAt: new Date(),
        });
        mechanic.id = ref.id;
      }
      mechanic.createdBy = ownerId;
      setAllMechanics((prev) => [mechanic, ...prev]);
      // Modal stays open here — MechanicModal shows a success screen and
      // calls onFinish (which opens the dashboard) once the user taps "Got it".
    }
  };

  const deleteMechanic = async (mechanic) => {
    if (!confirm(`Are you sure you want to delete ${mechanic.name}?`)) return;
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'mechanics', mechanic.id));
      setAllMechanics((prev) => prev.filter((m) => m.id !== mechanic.id));
      setSelectedMechanic(null);
      show('Mechanic deleted.');
    } catch (err) {
      show('Failed to delete mechanic.');
    }
  };

  const handleRated = (mechanicId, newRating) => {
    setAllMechanics((prev) =>
      prev.map((m) => m.id === mechanicId ? { ...m, rating: newRating } : m),
    );
    recordInteraction(mechanicId, 'rate');
  };

  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const businessOwnerId = user?.uid || localBusinessOwnerId;
  const myBusiness = allMechanics.find((m) => m.createdBy === businessOwnerId) || null;

  const handleOpenBusiness = () => {
    setMobileSidebarOpen(false);
    if (myBusiness) {
      setBusinessDashboardOpen(true);
      return;
    }
    setModal({ type: 'auth', reason: 'business' });
  };

  if (businessDashboardOpen) {
    return (
      <BusinessDashboard
        user={user}
        mechanic={myBusiness}
        onExit={() => setBusinessDashboardOpen(false)}
        show={show}
      />
    );
  }

  return (
    <div className="app-container">
      <Helmet>
        <title>{searchedArea ? `Mechanics near ${searchedArea} | Gears` : 'Gears — Mechanics near you in Ghana'}</title>
        <meta name="description" content={searchedArea ? `Find trusted auto repair shops and mechanics near ${searchedArea}.` : 'Gears — Find trusted mechanics near you across Ghana. Search garages by area, read ratings, and call a mechanic directly.'} />
      </Helmet>
      
      {notice && <div className="notice" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: '#155e42', color: 'white', padding: '10px 20px', borderRadius: '8px' }}>{notice}</div>}
      
      <Sidebar
        user={user}
        authReady={authReady}
        viewMode={viewMode}
        setViewMode={setViewMode}
        openAuth={() => setModal('auth')}
        onSignOut={() => { signOut(auth); setUser(null); }}
        onOpenBusiness={handleOpenBusiness}
        isOpen={isMobileSidebarOpen}
        setIsOpen={setMobileSidebarOpen}
        isSearchPanelOpen={isSearchPanelOpen}
        onSearchClick={() => {
          setMobileSidebarOpen(false);
          setIsSearchPanelOpen(prev => !prev);
          if (searchRef.current) searchRef.current.focus();
        }}
        onCloseSearch={() => setIsSearchPanelOpen(false)}
        onCloseDetail={handleCloseDetail}
      />
      
      <div className="main-content">
        {/* Mobile floating map controls */}
        <div className="mobile-map-controls">
          <button className="mobile-hamburger" aria-label="Menu" onClick={() => setMobileSidebarOpen(true)}>
            <List size={20} />
          </button>
          <div className="mobile-map-actions">
            <button className="map-action-btn" aria-label="Locate Me" onClick={() => setMapPanTrigger(Date.now())}>
              <NavigationArrow size={20} />
            </button>
          </div>
        </div>

        <MapLayout
          mechanics={mechanics}
          selectedMechanic={selectedMechanic}
          onSelectMechanic={handleSelectMechanic}
          userLocation={userLocation}
          mapPanTrigger={mapPanTrigger}
          routeTarget={routeTarget}
          isLocatingScan={isLocatingScan}
        />

        {!isSearchPanelOpen && viewMode !== 'notifications' && (
          <MechanicListPanel
            mechanics={mechanics}
            searchedArea={searchedArea}
            onSearch={handleSmartSearch}
            onSelect={handleSelectMechanic}
            user={user}
            savedMechanics={savedMechanics}
            onToggleSave={toggleSave}
            viewMode={viewMode}
            searchRef={searchRef}
            onOpenSearch={() => setIsSearchPanelOpen(true)}
            onDirection={handleShowDirection}
            recentInteractions={recentInteractions}
            onRecordInteraction={recordInteraction}
            hideOnDesktop={!!selectedMechanic}
              onUseMyLocation={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                      setMapPanTrigger(Date.now());
                    },
                    (err) => console.warn("Location error:", err),
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                  );
                } else {
                  setMapPanTrigger(Date.now());
                }
              }}
            onScanStateChange={setIsLocatingScan}
            onNavigateHome={() => setViewMode('all')}
            onOpenSidebar={() => setMobileSidebarOpen(true)}
          />
        )}

        {isSearchPanelOpen && (
          <SearchPanel
            mechanics={mechanics}
            searchedArea={searchedArea}
            onSearch={handleSmartSearch}
            onSelect={handleSelectMechanic}
            user={user}
            savedMechanics={savedMechanics}
            onToggleSave={toggleSave}
            viewMode={viewMode}
            searchRef={searchRef}
            onClose={() => setIsSearchPanelOpen(false)}
          />
        )}

        {viewMode === 'notifications' && (
          <NotificationsPanel
            onOpenSidebar={() => setMobileSidebarOpen(true)}
            onSelectMechanic={handleSelectMechanic}
            mechanics={mechanics}
          />
        )}

        <MechanicDetailPanel
           mechanic={selectedMechanic}
           onClose={handleCloseDetail}
           user={user}
           onEdit={(m) => setModal({ type: 'edit', mechanic: m })}
           onDelete={deleteMechanic}
           onRate={(m) => setModal({ type: 'rate', mechanic: m })}
           savedMechanics={savedMechanics}
           onToggleSave={toggleSave}
           onDirection={handleShowDirection}
           onRecordInteraction={recordInteraction}
           initialItemQuery={pendingItemQuery}
           onInitialItemHandled={() => setPendingItemQuery(null)}
        />
      </div>

      {notice && <div className="toast" role="status">{notice}</div>}

      {/* Auth modal */}
      {(modal === 'auth' || modal?.type === 'auth') && (
        <AuthModal
          close={() => setModal(null)}
          onSuccess={(u) => {
            if (u) setUser(u);
            setModal(modal?.reason === 'business' ? 'add' : null);
          }}
          show={show}
          reason={modal?.reason}
        />
      )}
      {modal?.type === 'auth-for-rate' && (
        <AuthModal
          close={() => setModal(null)}
          onSuccess={(u) => { setUser(u); setModal({ type: 'rate', mechanic: modal.mechanic }); }}
          show={show}
          reason="rate"
        />
      )}

      {/* Add / Edit mechanic modal */}
      {(modal === 'add' || modal?.type === 'edit') && (
        <MechanicModal
          close={() => setModal(null)}
          submit={submitMechanic}
          initialData={modal?.type === 'edit' ? modal.mechanic : null}
          onFinish={() => { setBusinessDashboardOpen(true); setModal(null); }}
        />
      )}

      {/* Rate mechanic modal */}
      {modal?.type === 'rate' && (
        <RateModal
          mechanic={modal.mechanic}
          user={user}
          close={() => setModal(null)}
          onRated={handleRated}
          show={show}
          openAuth={() => setModal({ type: 'auth-for-rate', mechanic: modal.mechanic })}
        />
      )}
      
      {/* Floating Add Button for authorized admins only */}
      {user && (user.email === 'aciestech21@gmail.com' || user.email === 'skyemmanuel42@gmail.com' || user.email === 'princeessandoh316@gmail.com') && (
        <button 
          className="floating-add-btn" 
          onClick={() => setModal('add')}
        >
          <Plus size={24} weight="bold" className="add-icon" />
          <span className="btn-text">Add Mechanic</span>
        </button>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
