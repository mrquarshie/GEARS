import { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import osmMechanicsData from './osm_mechanics.json';
import mockExtrasData from './mockExtras.json';
import { loadRecentInteractions, saveRecentInteractions } from './recentInteractions';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { List, NavigationArrow, Gear, X, Plus } from '@phosphor-icons/react';
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
import MapLayout from './components/MapLayout';
import MechanicListPanel from './components/MechanicListPanel';
import MechanicDetailPanel from './components/MechanicDetailPanel';
import SearchPanel from './components/SearchPanel';
import NotificationsPanel from './components/NotificationsPanel';

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
};

function AuthModal({ close, onSuccess, reason }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const headline = AUTH_REASON_COPY[reason] || 'Find trusted mechanics, anywhere in Ghana.';

  const loginWithGoogle = async () => {
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
      <div className="auth-modal-content">
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
            <p style={{width:'100%'}}>{loading ? 'Please wait…' : 'Continue with Google'}</p>
     
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
function LocationPicker({ lat, lng, setLat, setLng }) {
  useMapEvents({
    click(e) {
      setLat(e.latlng.lat);
      setLng(e.latlng.lng);
    },
  });
  return lat && lng ? <Marker position={[lat, lng]} /> : null;
}

function MechanicModal({ close, submit, initialData }) {
  const [name, setName] = useState(initialData?.name || '');
  const [area, setArea] = useState(initialData?.area || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [specialty, setSpecialty] = useState(initialData?.specialty && initialData.specialty !== 'General repairs' ? initialData.specialty : '');
  const [saving, setSaving] = useState(false);
  
  // For coordinates
  const [lat, setLat] = useState(initialData?.lat || 5.6037);
  const [lng, setLng] = useState(initialData?.lng || -0.1870);

  const send = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { 
      await submit({ name, area, phone, specialty: specialty.trim() || 'General repairs', lat, lng }, initialData); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={send}>
        <button type="button" className="close" onClick={close} aria-label="Close">×</button>
        <span className="modal-icon">{initialData ? '✎' : '＋'}</span>
        <h2>{initialData ? 'Edit mechanic' : 'Add a mechanic'}</h2>
        <p>{initialData ? 'Update details for this mechanic.' : 'Help drivers find a trusted mechanic in Ghana.'}</p>
        <label>Garage or mechanic name
          <input id="add-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>Area / landmark
          <input id="add-area" required value={area} onChange={(e) => setArea(e.target.value)} />
        </label>
        <label>Specialty
          <select id="add-specialty" required value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            <option value="" disabled>Select a specialty...</option>
            <option value="General Repairs">General Repairs</option>
            <option value="Brakes">Brakes</option>
            <option value="Electric Fault">Electric Fault</option>
            <option value="Lights">Lights</option>
            <option value="Engine">Engine</option>
            <option value="Spraying">Spraying</option>
            <option value="Upgrade">Upgrade</option>
            <option value="Diagnostics">Diagnostics</option>
            <option value="Car Detailing">Car Detailing</option>
            <option value="Fuel Station">Fuel Station</option>
          </select>
        </label>
        <label>Phone number
          <input id="add-phone" required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        
        <label>Location (Click on the map to drop a pin)
          <div style={{ height: '200px', width: '100%', marginTop: '8px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <MapContainer center={[lat, lng]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <LocationPicker lat={lat} lng={lng} setLat={setLat} setLng={setLng} />
            </MapContainer>
          </div>
        </label>

        <button id="btn-submit-mechanic" className="primary" disabled={saving}>
          {saving ? 'Saving…' : (initialData ? 'Save changes' : 'Submit mechanic')}
        </button>
      </form>
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
  const searchRef = useRef(null);

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
      const mockData = [...osmMechanicsData, ...mockExtrasData].map((m, i) => ({ id: `mock-${i}`, ...m }));
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
          setModal(null);
        }
      } catch (e) {
        console.error('Redirect result error:', e);
        setNotice('Auth Error: ' + e.message.replace('Firebase: ', ''));
      }

      // Step 2: subscribe to ongoing auth changes (fires immediately with current user)
      unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthReady(true);
        if (u) setModal(null);
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
    if (!db) return;

    if (!existingData || existingData.phone !== listing.phone) {
      const q = query(collection(db, 'mechanics'), where('phone', '==', listing.phone));
      const snap = await getDocs(q);
      if (!snap.empty) {
        show('A mechanic with this phone number already exists.');
        throw new Error('Duplicate phone');
      }
    }

    if (existingData) {
      await updateDoc(doc(db, 'mechanics', existingData.id), listing);
      setAllMechanics((prev) =>
        prev.map((m) => m.id === existingData.id ? { ...m, ...listing } : m)
      );
      show('Mechanic updated!');
    } else {
      const mechanic = { ...listing, specialty: listing.specialty || 'General repairs', rating: 'New', ratingCount: 0, ratingSum: 0, open: true };
      const ref = await addDoc(collection(db, 'mechanics'), {
        ...mechanic,
        createdBy: user?.uid,
        createdAt: new Date(),
      });
      mechanic.id = ref.id;
      mechanic.createdBy = user?.uid;
      setAllMechanics((prev) => [mechanic, ...prev]);
      show('Mechanic submitted — thank you!');
    }
    setModal(null);
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
        />
      </div>

      {notice && <div className="toast" role="status">{notice}</div>}

      {/* Auth modal */}
      {(modal === 'auth' || modal?.type === 'auth') && (
        <AuthModal
          close={() => setModal(null)}
          onSuccess={(u) => { setUser(u); setModal(null); }}
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
      {user && (user.email === 'aciestech21@gmail.com' || user.email === 'skyemmanuel42@gmail.com') && (
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
