import { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import osmMechanicsData from './osm_mechanics.json';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { List, MapTrifold, NavigationArrow, Gear, X, Plus } from '@phosphor-icons/react';
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
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { auth, db, firebaseReady } from './firebase';
import './styles.css';

import Sidebar from './components/Sidebar';
import MapLayout from './components/MapLayout';
import MechanicListPanel from './components/MechanicListPanel';
import MechanicDetailPanel from './components/MechanicDetailPanel';
import SearchPanel from './components/SearchPanel';

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
function AuthModal({ close, onSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!firebaseReady) return setErrorMsg('Add your Firebase settings to .env first.');
    setLoading(true);
    setErrorMsg('');
    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        onSuccess(cred.user);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        onSuccess(cred.user);
      }
    } catch (err) {
      setErrorMsg(err.message.replace('Firebase: ', ''));
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    if (!firebaseReady) return setErrorMsg('Add your Firebase settings to .env first.');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setLoading(true);
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
          <X size={20} />
        </button>
        
        <div className="auth-gear-wrapper">
          <Gear size={48} className="auth-logo-spin" weight="bold" />
        </div>
        
        <h2 className="auth-title">
          {isSignUp ? 'Create an account' : 'Sign in to continue'}
        </h2>
        <p className="auth-subtitle">
          {isSignUp ? 'Sign up to add or rate mechanics.' : 'Sign in to add or rate mechanics.'}
        </p>

        {errorMsg && <div style={{color: 'var(--red)', fontSize: '0.9rem', marginBottom: '16px'}}>{errorMsg}</div>}

        <form onSubmit={submit} style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
          {isSignUp && (
            <div className="auth-input-group">
              <label className="auth-input-label">Full name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required={isSignUp}
                className="auth-input-field"
              />
            </div>
          )}
          
          <div className="auth-input-group">
            <label className="auth-input-label">Email address</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required
              className="auth-input-field"
            />
          </div>
          
          <div className="auth-input-group">
            <label className="auth-input-label">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              minLength={6}
              className="auth-input-field"
            />
          </div>
          
          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Please wait…' : (isSignUp ? 'Sign up' : 'Sign in')}
          </button>
        </form>

        <button 
          type="button" 
          className="auth-google-btn" 
          onClick={loginWithGoogle}
          disabled={loading}
        >
          <div className="auth-google-icon-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <div className="auth-google-separator"></div>
          <span className="auth-google-text">Continue with Google</span>
        </button>
        
        <div style={{textAlign: 'center'}}>
          <button 
            type="button" 
            onClick={() => setIsSignUp(!isSignUp)} 
            style={{background: 'none', border: 'none', color: 'var(--forest)', fontWeight: 700, fontSize: '14px', cursor: 'pointer', padding: 0}}
          >
            {isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
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
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const searchRef = useRef(null);

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
    if (!firebaseReady) { setLoading(false); setAuthReady(true); return; }

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
        distStr = rawDist.toFixed(1) + 'Km';
        timeInMinutes = (rawDist / 30) * 60;
      }
      return { ...m, distance: distStr, _rawDist: rawDist, timeInMinutes };
    });

    if (viewMode === 'saved') {
      list = list.filter(m => savedMechanics.includes(m.id));
    } else if (viewMode === 'detailers') {
      list = list.filter(m => m.specialty === 'Car Detailing');
    } else if (viewMode === 'fuel') {
      list = list.filter(m => m.specialty === 'Fuel Station');
    }
    
    // Sort by distance if location available
    if (userLocation) {
      list.sort((a, b) => a._rawDist - b._rawDist);
    }

    if (!searchedArea) return list;
    const term = searchedArea.toLowerCase();
    return list.filter(
      (m) =>
        m.area?.toLowerCase().includes(term) ||
        m.name?.toLowerCase().includes(term) ||
        m.specialty?.toLowerCase().includes(term),
    );
  }, [allMechanics, searchedArea, viewMode, savedMechanics, userLocation]);

  const show = (message) => { setNotice(message); setTimeout(() => setNotice(''), 3500); };

  const toggleSave = async (mechanic) => {
    if (!user) {
      setModal('auth');
      return;
    }
    const isSaved = savedMechanics.includes(mechanic.id);
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
        onSearchClick={() => {
          setMobileSidebarOpen(false);
          setIsSearchPanelOpen(prev => !prev);
          if (searchRef.current) searchRef.current.focus();
        }}
      />
      
      <div className="main-content">
        {/* Mobile floating map controls */}
        <div className="mobile-map-controls">
          <button className="mobile-hamburger" aria-label="Menu" onClick={() => setMobileSidebarOpen(true)}>
            <List size={20} />
          </button>
          <div className="mobile-map-actions">
            <button className="map-action-btn" aria-label="Map Layers">
              <MapTrifold size={20} />
            </button>
            <button className="map-action-btn" aria-label="Locate Me" onClick={() => setMapPanTrigger(Date.now())}>
              <NavigationArrow size={20} />
            </button>
          </div>
        </div>

        <MapLayout 
          mechanics={mechanics} 
          selectedMechanic={selectedMechanic} 
          onSelectMechanic={setSelectedMechanic}
          userLocation={userLocation}
          mapPanTrigger={mapPanTrigger}
        />
        
        {!isSearchPanelOpen && (
          <MechanicListPanel 
            mechanics={mechanics} 
            searchedArea={searchedArea} 
            onSearch={setSearchedArea} 
            onSelect={setSelectedMechanic} 
            user={user} 
            savedMechanics={savedMechanics}
            onToggleSave={toggleSave}
            viewMode={viewMode}
            searchRef={searchRef}
          />
        )}

        {isSearchPanelOpen && (
          <SearchPanel
            mechanics={mechanics}
            searchedArea={searchedArea}
            onSearch={setSearchedArea}
            onSelect={setSelectedMechanic}
            user={user}
            savedMechanics={savedMechanics}
            onToggleSave={toggleSave}
            searchRef={searchRef}
            onClose={() => setIsSearchPanelOpen(false)}
          />
        )}
        
        <MechanicDetailPanel 
           mechanic={selectedMechanic} 
           onClose={() => setSelectedMechanic(null)} 
           user={user} 
           onEdit={(m) => setModal({ type: 'edit', mechanic: m })}
           onDelete={deleteMechanic}
           onRate={(m) => setModal({ type: 'rate', mechanic: m })}
           savedMechanics={savedMechanics}
           onToggleSave={toggleSave}
        />
      </div>

      {notice && <div className="toast" role="status">{notice}</div>}

      {/* Auth modal */}
      {modal === 'auth' && (
        <AuthModal
          close={() => setModal(null)}
          onSuccess={(u) => { setUser(u); setModal(null); }}
          show={show}
        />
      )}
      {modal?.type === 'auth-for-rate' && (
        <AuthModal
          close={() => setModal(null)}
          onSuccess={(u) => { setUser(u); setModal({ type: 'rate', mechanic: modal.mechanic }); }}
          show={show}
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
