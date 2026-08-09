import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Heart } from '@phosphor-icons/react';
import { collectionGroup, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';
import {
  BookmarkIcon,
  CallIcon,
  FilterIcon,
  LocationIcon,
  RateIcon,
  SearchIcon,
  ShareIcon,
  StarRatingIcon,
} from './icons';

const MOCK_DETAILERS = [
  { id: 1, name: 'Aura Detailers', area: 'Asafo, Kumasi', rating: 4.6, open: true },
  { id: 2, name: 'Sparkle Auto Care', area: 'Osu, Accra', rating: 4.8, open: true }
];

export default function SearchPanel({ mechanics, searchedArea, onSearch, onSelect, user, savedMechanics, onToggleSave, searchRef, onClose }) {
  const [searchTerm, setSearchTerm] = useState(searchedArea || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState('Services');
  const [activeMainTab, setActiveMainTab] = useState('All Services');
  
  const filterRef = useRef(null);
  const searchWrapperRef = useRef(null);
  const searchFocusedRef = useRef(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const suggestions = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    const uniqueMatches = new Map();
    mechanics.forEach(m => {
      if (m.name?.toLowerCase().includes(term)) uniqueMatches.set(m.name, { type: 'Name', value: m.name });
      else if (m.area?.toLowerCase().includes(term)) uniqueMatches.set(m.area, { type: 'Area', value: m.area });
      else if (m.services?.some(s => s.toLowerCase().includes(term))) {
        const match = m.services.find(s => s.toLowerCase().includes(term));
        if (match) uniqueMatches.set(match, { type: 'Service', value: match });
      }
    });
    return Array.from(uniqueMatches.values()).slice(0, 5);
  }, [searchTerm, mechanics]);

  const [popularProducts, setPopularProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) setIsFilterOpen(false);
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Prevent visual-viewport scrolling when the search input is focused on mobile.
  useEffect(() => {
    if (!isMobile) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const lock = () => {
      if (searchFocusedRef.current && viewport.offsetTop > 0) {
        window.scrollTo(0, 0);
      }
    };
    viewport.addEventListener('scroll', lock);
    return () => viewport.removeEventListener('scroll', lock);
  }, [isMobile]);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const q = query(collectionGroup(db, 'products'), limit(10));
        const snap = await getDocs(q);
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPopularProducts(fetched);
      } catch (e) {
        console.error("Failed to fetch products", e);
      } finally {
        setLoadingProducts(false);
      }
    }
    fetchProducts();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setShowSuggestions(false);
    onSearch(searchTerm);
    onClose();
  };

  const topMechanics = useMemo(() => {
    return [...mechanics].sort((a, b) => {
      const aRating = a.rating === 'New' ? 0 : Number(a.rating);
      const bRating = b.rating === 'New' ? 0 : Number(b.rating);
      if (bRating !== aRating) return bRating - aRating;
      const aCount = a.ratingCount || 0;
      const bCount = b.ratingCount || 0;
      return bCount - aCount;
    }).slice(0, 4);
  }, [mechanics]);

  return (
    <div className="search-panel-overlay slide-in">
      <div className="list-header">
        <h1>Search</h1>
        <p className="search-subtitle">Discover mechanics, detailers, car parts or people</p>
        
        <form className="search-bar-wrapper" onSubmit={handleSearchSubmit} ref={searchWrapperRef}>
          <div className="search-input-box">
            <SearchIcon size={18} className="search-icon" />
            <input 
              ref={searchRef}
              type="text" 
              placeholder="Search Location" 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (searchTerm) setShowSuggestions(true);
                if (isMobile) searchFocusedRef.current = true;
              }}
              onBlur={() => {
                searchFocusedRef.current = false;
              }}
            />
          </div>
          
          {showSuggestions && suggestions.length > 0 && (
            <div className="search-suggestions">
              {suggestions.map((s, i) => (
                <div 
                  key={i} 
                  className="suggestion-item" 
                  onClick={() => {
                    setSearchTerm(s.value);
                    setShowSuggestions(false);
                    onSearch(s.value);
                    onClose();
                  }}
                >
                  <SearchIcon size={14} className="suggestion-icon" />
                  <span className="suggestion-text">{s.value}</span>
                  <span className="suggestion-type">{s.type}</span>
                </div>
              ))}
            </div>
          )}

          <div className="filter-container" ref={filterRef}>
            <button type="button" className="filter-btn" onClick={() => setIsFilterOpen(!isFilterOpen)}>
              <FilterIcon size={18} />
            </button>
            {isFilterOpen && (
              <div className="filter-popup">
                <div className="filter-header">
                  <h2>Filters</h2>
                  <button type="button" className="clear-all-btn">Clear all</button>
                </div>
                <div className="filter-tabs">
                  <div className={`filter-tab ${activeFilterTab === 'Services' ? 'active' : ''}`} onClick={() => setActiveFilterTab('Services')}>Services <span className="tab-badge">2</span></div>
                  <div className={`filter-tab ${activeFilterTab === 'Availability' ? 'active' : ''}`} onClick={() => setActiveFilterTab('Availability')}>Availability</div>
                  <div className={`filter-tab ${activeFilterTab === 'Distance' ? 'active' : ''}`} onClick={() => setActiveFilterTab('Distance')}>Distance</div>
                  <div className={`filter-tab ${activeFilterTab === 'Rating' ? 'active' : ''}`} onClick={() => setActiveFilterTab('Rating')}>Rating</div>
                </div>
                
                {activeFilterTab === 'Services' && (
                  <div className="filter-body">
                    <button type="button" className="filter-pill active">General Repair</button>
                    <button type="button" className="filter-pill">Breaks</button>
                    <button type="button" className="filter-pill">Electric Fault</button>
                    <button type="button" className="filter-pill">Lights</button>
                    <button type="button" className="filter-pill active">Engine</button>
                    <button type="button" className="filter-pill">Spraying</button>
                    <button type="button" className="filter-pill">Upgrade</button>
                    <button type="button" className="filter-pill">Diagnostics</button>
                  </div>
                )}
                {/* Other filter tabs can be added similarly */}
                <div className="filter-footer">
                  <button type="button" className="filter-apply-btn" onClick={() => setIsFilterOpen(false)}>Apply</button>
                </div>
              </div>
            )}
          </div>
        </form>

        <div className="search-main-tabs">
          {['All Services', 'Products', 'Detailers', 'Shops'].map(tab => (
            <div 
              key={tab} 
              className={`search-main-tab ${activeMainTab === tab ? 'active' : ''}`}
              onClick={() => setActiveMainTab(tab)}
            >
              {tab}
            </div>
          ))}
        </div>
      </div>

      <div className="search-content-scroll">
        <section className="search-section">
          <h3>Top Mechanics</h3>
          <div className="horizontal-scroll">
            {topMechanics.map(m => (
              <div key={m.id} className="search-mechanic-card" onClick={() => { onSelect(m); onClose(); }}>
                <div className="sm-card-top">
                  <div className="sm-avatar">
                    <span className="avatar-letter">{m.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="sm-rating-badge">
                    {m.rating !== 'New' ? Number(m.rating).toFixed(1) : 'New'} <StarRatingIcon size={10} state="filled" />
                  </div>
                  <div className="sm-status-badge">Open</div>
                </div>
                <h4>{m.name}</h4>
                <p>{m.area}</p>
                <div className="sm-specialty">⚙ {m.specialty || 'General Repairs'}</div>
                <div className="sm-actions">
                  <button 
                    className={`icon-btn ${savedMechanics.includes(m.id) ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onToggleSave(m); }}
                  >
                    <BookmarkIcon size={14} state={savedMechanics.includes(m.id) ? 'filled' : 'default'} />
                  </button>
                  <button className="icon-btn"><RateIcon size={14} /></button>
                  <button className="icon-btn"><ShareIcon size={14} /></button>
                  <button className="icon-btn"><LocationIcon size={14} /></button>
                  <button className="icon-btn"><CallIcon size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="search-section">
          <h3>Popular Products</h3>
          <div className="horizontal-scroll">
            {loadingProducts ? (
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading products...</p>
            ) : popularProducts.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>no products posted yet</p>
            ) : (
              popularProducts.map(p => (
                <div key={p.id} className="search-product-card">
                  <div className="product-img-wrapper" style={{ background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.img ? (
                      <img src={p.img} alt={p.name} />
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '12px' }}>No Image</span>
                    )}
                    <button className="favorite-btn"><Heart size={16} /></button>
                  </div>
                  <div className="product-info">
                    <h4>{p.name}</h4>
                    <div className="product-meta">
                      <span className="price">GH₵ {p.price || 'N/A'}</span>
                      <span className="tag">⚡ Same Day</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="search-section">
          <h3>Trending Detailers</h3>
          <div className="horizontal-scroll">
            {MOCK_DETAILERS.map(d => (
              <div key={d.id} className="search-mechanic-card">
                <div className="sm-card-top">
                  <div className="sm-avatar" style={{backgroundColor: '#e5e7eb', color: '#000'}}>
                    <span className="avatar-letter">{d.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="sm-rating-badge">{d.rating.toFixed(1)} <StarRatingIcon size={10} state="filled" /></div>
                  <div className="sm-status-badge">Open</div>
                </div>
                <h4>{d.name}</h4>
                <p>{d.area}</p>
                <div className="sm-actions" style={{marginTop: '16px'}}>
                  <button className="icon-btn"><BookmarkIcon size={14} /></button>
                  <button className="icon-btn"><RateIcon size={14} /></button>
                  <button className="icon-btn"><ShareIcon size={14} /></button>
                  <button className="icon-btn"><LocationIcon size={14} /></button>
                  <button className="icon-btn"><CallIcon size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
