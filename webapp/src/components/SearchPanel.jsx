import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, X, Wrench, ClockCounterClockwise, ArrowRight } from '@phosphor-icons/react';
import { LocationIcon, FillingStationIcon, CarDetailingIcon } from './icons';
import { getPlaceholderPhrases } from '../searchPlaceholders';
import { useTypewriterPlaceholder } from '../hooks/useTypewriterPlaceholder';

const RECENT_SEARCHES_KEY = 'gearsRecentSearches';
const MAX_RECENT_SEARCHES = 5;

function loadRecentSearches() {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(list) {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
  } catch {
    // localStorage unavailable — recent searches just won't persist
  }
}

// Small icon per suggestion, matching what the row is actually pointing to.
function SuggestionRowIcon({ row, mechanicsByName }) {
  if (row.type === 'Area' || row.type === 'Location') {
    return <LocationIcon size={20} state="filled" />;
  }
  if (row.type === 'Fuel') {
    return <FillingStationIcon size={20} state="filled" />;
  }
  if (row.type === 'Name') {
    const specialty = mechanicsByName.get(row.value)?.specialty;
    if (specialty === 'Fuel Station') return <FillingStationIcon size={20} state="filled" />;
    if (specialty === 'Car Detailing') return <CarDetailingIcon size={20} state="filled" />;
  }
  return <Wrench size={20} />;
}

export default function SearchPanel({ mechanics, searchedArea, onSearch, searchRef, onClose, viewMode }) {
  const [searchTerm, setSearchTerm] = useState(searchedArea || '');
  const [recentSearches, setRecentSearches] = useState(loadRecentSearches);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const inputFocusedRef = useRef(false);

  const placeholderPhrases = getPlaceholderPhrases(viewMode);
  const placeholderText = useTypewriterPlaceholder(placeholderPhrases);

  // Autofocus the input as soon as the overlay mounts, regardless of how it was opened.
  useEffect(() => {
    searchRef?.current?.focus();
  }, [searchRef]);

  // Prevent visual-viewport scrolling when the input is focused on mobile, so
  // the map behind the overlay stays put instead of drifting under the
  // on-screen keyboard (native-app keyboard feel, same fix as the home search bar).
  useEffect(() => {
    if (!isMobile) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const lock = () => {
      // Reset both axes unconditionally — this app has no scrollable
      // document, so any window scroll while focused (vertical or
      // horizontal) is the keyboard-focus glitch, not a legitimate scroll.
      if (inputFocusedRef.current) {
        window.scrollTo(0, 0);
      }
    };
    viewport.addEventListener('scroll', lock);
    return () => viewport.removeEventListener('scroll', lock);
  }, [isMobile]);

  const mechanicsByName = useMemo(() => new Map(mechanics.map(m => [m.name, m])), [mechanics]);

  const suggestions = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    const uniqueMatches = new Map();
    mechanics.forEach(m => {
      if (m.name?.toLowerCase().includes(term)) uniqueMatches.set(m.name, { type: 'Name', value: m.name });
      if (m.area?.toLowerCase().includes(term)) uniqueMatches.set(m.area, { type: 'Area', value: m.area });
      if (m.specialty?.toLowerCase().includes(term)) uniqueMatches.set(m.specialty, { type: 'Category', value: m.specialty });
      if (m.locationDetail?.toLowerCase().includes(term)) uniqueMatches.set(m.locationDetail, { type: 'Location', value: m.locationDetail });
      (m.specialties || []).forEach(s => { if (s.toLowerCase().includes(term)) uniqueMatches.set(s, { type: 'Speciality', value: s }); });
      (m.services || []).forEach(s => {
        const serviceName = typeof s === 'string' ? s : s.name;
        if (serviceName?.toLowerCase().includes(term)) uniqueMatches.set(serviceName, { type: 'Service', value: serviceName });
      });
      (m.fuelPrices || []).forEach(f => { if (f.type?.toLowerCase().includes(term)) uniqueMatches.set(f.type, { type: 'Fuel', value: f.type }); });
    });
    return Array.from(uniqueMatches.values()).slice(0, 8);
  }, [searchTerm, mechanics]);

  // Default (no query yet) rows: a mix of top-rated businesses, areas and
  // categories pulled from real data, echoing the "popular searches" pattern.
  const popularSuggestions = useMemo(() => {
    const rows = [];

    const byRating = [...mechanics].sort((a, b) => {
      const aRating = a.rating === 'New' ? 0 : Number(a.rating) || 0;
      const bRating = b.rating === 'New' ? 0 : Number(b.rating) || 0;
      return bRating - aRating;
    });
    const namesSeen = new Set();
    for (const m of byRating) {
      if (namesSeen.size >= 2) break;
      if (m.name && !namesSeen.has(m.name)) { namesSeen.add(m.name); rows.push({ type: 'Name', value: m.name }); }
    }

    const areasSeen = new Set();
    for (const m of mechanics) {
      if (areasSeen.size >= 2) break;
      if (m.area && !areasSeen.has(m.area)) { areasSeen.add(m.area); rows.push({ type: 'Area', value: m.area }); }
    }

    const categoriesSeen = new Set();
    for (const m of mechanics) {
      if (categoriesSeen.size >= 2) break;
      if (m.specialty && !categoriesSeen.has(m.specialty)) { categoriesSeen.add(m.specialty); rows.push({ type: 'Category', value: m.specialty }); }
    }

    return rows;
  }, [mechanics]);

  const rowsToShow = searchTerm ? suggestions : popularSuggestions;

  const runSearch = (value) => {
    if (!value) return;
    setRecentSearches(prev => {
      const next = [value, ...prev.filter(v => v !== value)].slice(0, MAX_RECENT_SEARCHES);
      saveRecentSearches(next);
      return next;
    });
    onSearch(value);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runSearch(searchTerm.trim());
  };

  return (
    <div className="search-panel-overlay slide-in">
      <div className="search-focused-header">
        <form className="search-focused-input-box" onSubmit={handleSubmit}>
          <button type="button" className="search-focused-back" onClick={onClose} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <input
            ref={searchRef}
            type="text"
            placeholder=""
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => { inputFocusedRef.current = true; }}
            onBlur={() => { inputFocusedRef.current = false; }}
          />
          {!searchTerm && (
            <span className="search-focused-placeholder-animated">
              <span className="search-placeholder-prefix">Search </span>
              <span className="search-placeholder-suffix">{placeholderText}<span className="placeholder-cursor">|</span></span>
            </span>
          )}
          {searchTerm && (
          
              <svg onClick={() => setSearchTerm('')} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5.33464 15.8334L4.16797 14.6667L8.83464 10.0001L4.16797 5.33341L5.33464 4.16675L10.0013 8.83341L14.668 4.16675L15.8346 5.33341L11.168 10.0001L15.8346 14.6667L14.668 15.8334L10.0013 11.1667L5.33464 15.8334Z" fill="black" fill-opacity="0.6" />
              </svg>

          )}
        </form>
      </div>

      <div className="search-focused-scroll">
        {!searchTerm && recentSearches.length > 0 && (
          <div>
            <h3 className="search-section-label">Recent</h3>
            <div className="search-recent-chips">
              {recentSearches.map((term) => (
                <button key={term} type="button" className="search-recent-chip" onClick={() => runSearch(term)}>
                  <ClockCounterClockwise size={14} />
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {rowsToShow.length > 0 && (
          <div className="search-suggestion-list">
            {rowsToShow.map((row, i) => (
              <div key={`${row.type}-${row.value}-${i}`} className="search-suggestion-row" onClick={() => runSearch(row.value)}>
                <span className="search-suggestion-row-icon">
                  <SuggestionRowIcon row={row} mechanicsByName={mechanicsByName} />
                </span>
                <span className="search-suggestion-row-text">{row.value}</span>
                <ArrowRight size={18} className="search-suggestion-row-caret" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
