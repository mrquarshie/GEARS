import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Target, ArrowLeft } from '@phosphor-icons/react';
import {
  BookmarkIcon,
  CallIcon,
  FillingStationIcon,
  FilterIcon,
  LocationIcon,
  RateIcon,
  SearchIcon,
  ShareIcon,
  StarRatingIcon,
} from './icons';

// Expanding drive-time windows used by the "Use my location" search: start tight
// (5-10 min) and widen in 10-minute steps up to an hour until a window has a match.
const NEAR_ME_BUCKETS = [
  { min: 5, max: 10 },
  { min: 10, max: 20 },
  { min: 20, max: 30 },
  { min: 30, max: 40 },
  { min: 40, max: 50 },
  { min: 50, max: 60 },
];

function rangeLabel(t) {
  const bucket = NEAR_ME_BUCKETS.find(b => t <= b.max) || NEAR_ME_BUCKETS[NEAR_ME_BUCKETS.length - 1];
  return `${bucket.min}–${bucket.max}`;
}

function findNearMeBucket(list) {
  for (const bucket of NEAR_ME_BUCKETS) {
    if (list.some(m => m.timeInMinutes != null && m.timeInMinutes <= bucket.max)) {
      return bucket;
    }
  }
  return null;
}

const PRODUCT_PLACEHOLDER_COLORS = [
  '#dcfce7', '#fefce8', '#f5d0fe', '#dbeafe', '#ffedd5',
  '#fce7f3', '#e0e7ff', '#ccfbf1', '#fef3c7', '#e0f2fe',
];

function hashToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PRODUCT_PLACEHOLDER_COLORS[Math.abs(hash) % PRODUCT_PLACEHOLDER_COLORS.length];
}

function FeaturedProduct({ item }) {
  return (
    <div className="featured-product">
      <div
        className="featured-product-image"
        style={{ background: item.imageUrl ? undefined : hashToColor(item.name || '') }}
      >
        {item.imageUrl && <img src={item.imageUrl} alt={item.name} />}
      </div>
      <h5 className="featured-product-name">{item.name}</h5>
      {item.price && <p className="featured-product-price">₵ {item.price}</p>}
    </div>
  );
}

// The actual bucket search resolves almost instantly (location is usually already
// known), which makes the scanning UI flash by unnoticed. Force it to run for at
// least this long so the loading/radar sequence is actually visible.
const MIN_SCAN_MS = 3500;

export default function MechanicListPanel({ mechanics, searchedArea, onSearch, onSelect, user, savedMechanics, onToggleSave, viewMode, searchRef, onDirection, hideOnDesktop, onUseMyLocation, onScanStateChange }) {
  const [searchTerm, setSearchTerm] = useState(searchedArea || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState('Services');
  const [currentSort, setCurrentSort] = useState('Near You');
  const [isScanning, setIsScanning] = useState(false);
  const [nearMeRange, setNearMeRange] = useState(null);
  const [bookmarkSubTab, setBookmarkSubTab] = useState('Mechanics');
  const [directionTargetId, setDirectionTargetId] = useState(null);

  // --- Swipeable Bottom Sheet State ---
  const [sheetState, setSheetState] = useState('minimized'); // 'minimized', 'half', 'expanded'
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  const sortRef = useRef(null);
  const filterRef = useRef(null);
  const searchWrapperRef = useRef(null);
  const scanStartRef = useRef(0);

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

  const popularProducts = useMemo(() => {
    if (viewMode !== 'shop') return [];
    return mechanics
      .filter(m => (m.products || []).length > 0)
      .flatMap(m => (m.products || []).map(p => ({ ...p, mechanicName: m.name, mechanicId: m.id })))
      .slice(0, 8);
  }, [mechanics, viewMode]);

  // Filter bookmarks by sub-tab category
  const bookmarkedMechanics = useMemo(() => {
    if (viewMode !== 'saved' && viewMode !== 'history') return mechanics;
    const subTabMap = {
      Mechanics: m => !['Car Detailing', 'Fuel Station', 'Shop', 'Parts Shop', 'Auto Parts'].includes(m.specialty),
      Shops: m => ['Shop', 'Parts Shop', 'Auto Parts'].includes(m.specialty),
      Detailers: m => m.specialty === 'Car Detailing',
      'Filling Stations': m => m.specialty === 'Fuel Station',
    };
    const filterFn = subTabMap[bookmarkSubTab] || subTabMap.Mechanics;
    return mechanics.filter(filterFn);
  }, [mechanics, viewMode, bookmarkSubTab]);

  const sortOptions = ['Near You', 'Top Rated', 'Most Popular', 'Open Now'];

  // Once mechanics have distance data (location was obtained), wait out whatever's
  // left of MIN_SCAN_MS so the scanning/radar sequence always plays for a beat,
  // then find the tightest drive-time window that actually has a mechanic in it.
  useEffect(() => {
    if (!isScanning || !mechanics.some(m => m.distance)) return;
    const remaining = Math.max(0, MIN_SCAN_MS - (Date.now() - scanStartRef.current));
    const timer = setTimeout(() => {
      setIsScanning(false);
      setNearMeRange(findNearMeBucket(mechanics));
    }, remaining);
    return () => clearTimeout(timer);
  }, [mechanics, isScanning]);

  // Auto-stop scanning after 8s timeout as fallback
  useEffect(() => {
    if (!isScanning) return;
    const timer = setTimeout(() => setIsScanning(false), 8000);
    return () => clearTimeout(timer);
  }, [isScanning]);

  // Leaving "near me" mode when the category changes avoids showing a stale filter.
  useEffect(() => {
    setNearMeRange(null);
  }, [viewMode]);

  // Let the map show a radar-scanning animation on the user's location dot while active.
  useEffect(() => {
    if (onScanStateChange) onScanStateChange(isScanning);
  }, [isScanning, onScanStateChange]);

  const handleScanLocation = () => {
    scanStartRef.current = Date.now();
    setIsScanning(true);
    if (onUseMyLocation) onUseMyLocation();
  };

  const displayedMechanics = nearMeRange
    ? mechanics.filter(m => m.timeInMinutes != null && m.timeInMinutes <= nearMeRange.max)
    : viewMode === 'saved' ? bookmarkedMechanics
    : viewMode === 'history' ? bookmarkedMechanics
    : mechanics;

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) setIsFilterOpen(false);
      if (sortRef.current && !sortRef.current.contains(event.target)) setIsSortOpen(false);
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setShowSuggestions(false);
    onSearch(searchTerm);
  };

  // --- Drag Handlers ---
  const handleTouchStart = (e) => {
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - dragStartY.current;
    
    // Allow dragging up (negative delta) or down (positive delta)
    setDragOffset(delta);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 50; // pixels to trigger state change

    if (dragOffset < -threshold) {
      // Swiped UP
      if (sheetState === 'minimized') setSheetState('half');
      else if (sheetState === 'half') setSheetState('expanded');
    } else if (dragOffset > threshold) {
      // Swiped DOWN
      if (sheetState === 'expanded') setSheetState('half');
      else if (sheetState === 'half') setSheetState('minimized');
    }
    
    setDragOffset(0); // Reset visual offset
  };

  // Calculate dynamic transform based on state and drag offset
  let transformBase = 'calc(100% - 150px)'; // minimized
  if (sheetState === 'half') transformBase = '50vh';
  if (sheetState === 'expanded') transformBase = '200px';

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const dynamicStyle = isMobile ? {
    transform: `translateY(calc(${transformBase} + ${dragOffset}px))`
  } : {};

  return (
    <div
      className={`mechanic-list-panel ${isDragging ? 'dragging' : ''} ${hideOnDesktop ? 'mechanic-list-panel--hidden-desktop' : ''}`}
      style={dynamicStyle}
    >
      <div
        className="list-drag-strip"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mobile-drag-handle"></div>
      </div>

      <div className="mechanic-list-scroll">
        {nearMeRange && (
          <div className="near-me-header">
            <button
              type="button"
              className="near-me-back"
              onClick={() => setNearMeRange(null)}
              aria-label="Back"
            >
              <ArrowLeft size={18} weight="bold" />
            </button>
            <span className="near-me-label">{nearMeRange.min} - {nearMeRange.max} minutes from my location</span>
          </div>
        )}

        {!nearMeRange && (
        <>
        {(viewMode === 'saved' || viewMode === 'history') ? (
          /* Title + tabs pin to the top together while the cards below scroll. */
          <div className="list-sticky-header">
            <h1 className="list-title">{viewMode === 'saved' ? 'Bookmarks' : 'History'}</h1>
            <div className="bookmark-tabs">
              {['Mechanics', 'Shops', 'Detailers', 'Filling Stations'].map(tab => (
                <button
                  key={tab}
                  className={`bookmark-tab ${bookmarkSubTab === tab ? 'active' : ''}`}
                  onClick={() => setBookmarkSubTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        ) : (
        <h1 className="list-title">
          {viewMode === 'detailers' ? (
            <>Discover Car Detailers</>
          ) : viewMode === 'fuel' ? (
            <>Find Fuel Stations</>
          ) : viewMode === 'shop' ? (
            <>Auto Parts Dealers</>
          ) : (
            <>A Mechanic,<br />When You Need One.</>
          )}
        </h1>
        )}

        {viewMode === 'history' && (
          <p className="history-subtitle">Your calls, directions and interactions since last month</p>
        )}

        {/* Sticky "silver" search bar: sits in normal flow under the title at rest,
            then pins to the top of the scroll area once the title scrolls past it. */}
        {viewMode !== 'saved' && viewMode !== 'history' && (
        <div className="search-sticky-bar">
        <form className="search-bar-wrapper" onSubmit={handleSearchSubmit} ref={searchWrapperRef}>
          <div className="search-input-box">
            <SearchIcon size={18} className="search-icon" />
            <input 
              ref={searchRef}
              type="text" 
              placeholder={viewMode === 'fuel' ? "Search Location" : "Search Mechanics, Area..."}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (searchTerm) setShowSuggestions(true);
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
            {isFilterOpen && (() => {
              const filterPopup = (
                <div className="filter-popup">
                  <div className="mobile-drag-handle"></div>
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

                  {activeFilterTab === 'Availability' && (
                    <div className="filter-body">
                      <button type="button" className="filter-pill active">Weekdays</button>
                      <button type="button" className="filter-pill">24/7</button>
                      <button type="button" className="filter-pill">Week Days Only</button>
                      <button type="button" className="filter-pill">Weekends Only</button>
                      <button type="button" className="filter-pill active">Engine</button>
                      <button type="button" className="filter-pill">Spraying</button>
                    </div>
                  )}

                  {activeFilterTab === 'Distance' && (
                    <div className="filter-body">
                      <button type="button" className="filter-pill alt">1 km</button>
                      <button type="button" className="filter-pill alt active">3 km</button>
                      <button type="button" className="filter-pill alt">5 km</button>
                      <button type="button" className="filter-pill alt">10 km+</button>
                    </div>
                  )}

                  {activeFilterTab === 'Rating' && (
                    <div className="filter-body">
                      <button type="button" className="filter-pill alt">Any</button>
                      <button type="button" className="filter-pill alt">4.0+</button>
                      <button type="button" className="filter-pill alt active">4.5+</button>
                    </div>
                  )}
                  <div className="filter-footer">
                    <button type="button" className="filter-apply-btn" onClick={() => setIsFilterOpen(false)}>Apply</button>
                  </div>
                </div>
              );

              // On mobile the sheet is portaled to <body> — an ancestor's transform
              // (used for the drag/minimize system) would otherwise hijack this
              // "fixed" sheet's containing block and push it off-screen.
              if (isMobile) {
                return createPortal(
                  <>
                    <div className="filter-backdrop" onClick={() => setIsFilterOpen(false)}></div>
                    {filterPopup}
                  </>,
                  document.body
                );
              }
              return filterPopup;
            })()}
          </div>
        </form>
        </div>
        )}
        {viewMode !== 'saved' && viewMode !== 'history' && (
        <div className="list-meta">
          <span className="count">{displayedMechanics.length} {viewMode === 'detailers' ? 'Detailers' : viewMode === 'fuel' ? 'Fuel Stations' : viewMode === 'shop' ? 'Auto Parts Dealers' : 'Mechanics'} · {viewMode === 'saved' ? 'Bookmarks' : 'Near You'}</span>
          <div className="sort-container" ref={sortRef}>
            <span className="sort" onClick={() => setIsSortOpen(!isSortOpen)}>
              {currentSort}
            </span>
            {isSortOpen && (
              <div className="sort-dropdown">
                {sortOptions.map(option => (
                  <div 
                    key={option} 
                    className={`sort-option ${currentSort === option ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentSort(option);
                      setIsSortOpen(false);
                    }}
                  >
                    {option}
                    {currentSort === option && <Target size={16} weight="bold" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {viewMode !== 'saved' && viewMode !== 'history' && (
        <div
          className={`location-banner ${isScanning ? 'location-banner--scanning' : ''}`}
          role="button"
          tabIndex={0}
          onClick={handleScanLocation}
          onKeyDown={(e) => { if (e.key === 'Enter') handleScanLocation(); }}
        >
          <div className="location-icon-wrapper">
            {isScanning ? (
              <div className="scanning-spinner"></div>
            ) : viewMode === 'fuel' ? (
              <FillingStationIcon size={20} state="filled" color="var(--forest)" />
            ) : (
              <LocationIcon size={20} state="filled" color="var(--forest)" />
            )}
          </div>
          <div className="location-banner-text">
            <h4>{isScanning ? 'Scanning for mechanics nearby...' : viewMode === 'fuel' ? 'Fuel Delivery' : 'Use my location to find the mechanics'}</h4>
            <p>
              {isScanning ? (
                'Finding the closest mechanics around you'
              ) : (
                (() => {
                const validTimes = mechanics.map(m => m.timeInMinutes).filter(t => t != null);
                if (validTimes.length > 0) {
                  const minT = Math.max(1, Math.floor(Math.min(...validTimes)));
                  const maxT = Math.ceil(Math.max(...validTimes));
                  const prefix = viewMode === 'fuel' ? 'All fuel stations' : 'All Mechanics';

                  const minRange = rangeLabel(minT);
                  const maxRange = rangeLabel(maxT);

                  if (minRange === maxRange) return `${prefix} ${minRange} minutes drive from you`;
                  return `${prefix} ${minRange} to ${maxRange} minutes drive from you`;
                }
                return 'Allow location access to see driving times';
              })()
              )}
            </p>
          </div>
        </div>
        )}
        </>
        )}

        {viewMode === 'shop' && popularProducts.length > 0 && (
          <div className="popular-products-section">
            <h3 className="popular-products-title">Popular Products</h3>
            <div className="popular-products-scroll">
              {popularProducts.map((p, i) => (
                <div key={i} className="popular-product-card">
                  <div className="popular-product-image" style={{ background: hashToColor(p.name || '') }}>
                    {p.imageUrl && <img src={p.imageUrl} alt={p.name} />}
                    <button className="popular-product-bookmark" onClick={(e) => e.stopPropagation()}>
                      <BookmarkIcon size={14} />
                    </button>
                  </div>
                  <div className="popular-product-info">
                    <p className="popular-product-shop">
                      <span className="popular-product-from">From </span>
                      {p.mechanicName}
                    </p>
                    <h4 className="popular-product-name">{p.name}</h4>
                    {p.price && <p className="popular-product-price">₵ {p.price}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mechanic-cards">
        {displayedMechanics.map((m) => {
          const featuredProducts = (m.products || []).slice(0, 3);
          const showFeatured = viewMode === 'shop' && featuredProducts.length > 0;

          return (
          <div key={m.id} className={`mechanic-card ${directionTargetId === m.id ? 'mechanic-card--active' : ''}`} onClick={() => { setDirectionTargetId(null); onSelect(m); }}>
            {viewMode === 'fuel' ? (
              <>
                <div className="card-body">
                  <div className="fuel-card-header">
                    <img
                      className="fuel-card-logo"
                      src={
                        m.name.toLowerCase().includes('shell')
                          ? 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e8/Shell_logo.svg/100px-Shell_logo.svg.png'
                          : m.name.toLowerCase().includes('goil')
                          ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Goil_Logo.svg/100px-Goil_Logo.svg.png'
                          : 'https://placehold.co/32x32'
                      }
                      alt={m.name}
                    />
                    <div className="fuel-distance-badge">
                      <LocationIcon size={12} state="filled" color="var(--forest)" />
                      <span>{m.distance ? m.distance.replace(/ drive away$/, '') : '--'}</span>
                    </div>
                  </div>
                  <div className="card-header">
                    <h3 className="card-name">{m.name}</h3>
                    <p className="card-area">{m.area}</p>
                  </div>
                  <div className="fuel-price-chips">
                    <div className="fuel-price-chip">
                      <span className="fuel-price-label">Petrol -</span><span className="fuel-price-value"> ₵14.65</span>
                    </div>
                    <div className="fuel-price-chip">
                      <span className="fuel-price-label">Diesel -</span><span className="fuel-price-value fuel-price-diesel"> ₵15.08</span>
                    </div>
                  </div>
                </div>
                <div className="card-bottom-bar">
                  <div className="card-bottom-left">
                    <button
                      className={`card-bottom-icon ${savedMechanics.includes(m.id) ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onToggleSave(m); }}
                    >
                      <BookmarkIcon size={16} state={savedMechanics.includes(m.id) ? 'filled' : 'default'} color={savedMechanics.includes(m.id) ? 'var(--forest)' : 'currentColor'} />
                    </button>
                    <div className="card-bottom-divider"></div>
                  </div>
                  <button
                    className={`card-bottom-action ${directionTargetId === m.id ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); const nextId = directionTargetId === m.id ? null : m.id; setDirectionTargetId(nextId); onDirection(nextId ? m : null); }}
                  >
                    <LocationIcon size={16} />
                    <span className="card-action-label">Direction</span>
                  </button>
                  <button className="card-bottom-action fuel-delivery-btn" onClick={(e) => e.stopPropagation()}>
                    <FillingStationIcon size={14} />
                    <span>Delivery</span>
                    <span className="delivery-soon-pill">Soon</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="card-body">
                  <div className="card-badges-row">
                    <div className="card-avatar">{m.name.charAt(0).toUpperCase()}</div>
                    <div className="card-badges">
                      {m.distance && (
                        <div className="card-badge-pill">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="0.75" />
                            <path d="M6 3.5v3l2 1.5" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" />
                          </svg>
                          <span className="card-badge-value">{m.distance.replace(/ drive away$/, '')}</span>
                        </div>
                      )}
                      {m.rating && m.rating !== 'New' && (
                        <div className="card-badge-pill">
                          <span className="card-badge-rating">{Number(m.rating).toFixed(1)}</span>
                          <StarRatingIcon size={10} state="filled" />
                        </div>
                      )}
                      <div className="card-badge-open">Open</div>
                    </div>
                  </div>

                  <div className="card-header">
                    <h3 className="card-name">{m.name}</h3>
                    <p className="card-area">{m.area}</p>
                  </div>

                  {!showFeatured && viewMode !== 'detailers' && (
                    <div className="card-specialty">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="0.75" />
                        <circle cx="7" cy="7" r="2" fill="currentColor" opacity="0.2" />
                      </svg>
                      {m.specialty || 'General Repairs'}
                    </div>
                  )}

                  {showFeatured && (
                    <div className="card-featured-products">
                      {featuredProducts.map((p, i) => (
                        <FeaturedProduct key={p.id || i} item={p} />
                      ))}
                    </div>
                  )}

                  {viewMode === 'detailers' && (
                    <div className="detailer-thumbnails">
                      <div className="thumbnail-block"></div>
                      <div className="thumbnail-block"></div>
                      <div className="thumbnail-block"></div>
                    </div>
                  )}
                </div>

                <div className="card-bottom-bar">
                  <div className="card-bottom-left">
                    <button
                      className={`card-bottom-icon ${savedMechanics.includes(m.id) ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onToggleSave(m); }}
                    >
                      <BookmarkIcon size={16} state={savedMechanics.includes(m.id) ? 'filled' : 'default'} color={savedMechanics.includes(m.id) ? 'var(--forest)' : 'currentColor'} />
                    </button>
                    <button className="card-bottom-icon"><RateIcon size={16} /></button>
                    <button className="card-bottom-icon"><ShareIcon size={16} /></button>
                    <div className="card-bottom-divider"></div>
                  </div>
                  <button
                    className={`card-bottom-action ${directionTargetId === m.id ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); const nextId = directionTargetId === m.id ? null : m.id; setDirectionTargetId(nextId); onDirection(nextId ? m : null); }}
                  >
                    <LocationIcon size={16} />
                    <span className="card-action-label">Direction</span>
                  </button>
                  <button
                    className="card-bottom-action"
                    onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${m.phone.replace(/\s+/g, '')}`; }}
                  >
                    <CallIcon size={16} />
                    <span>Call</span>
                  </button>
                </div>
              </>
            )}
          </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
