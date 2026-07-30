import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Target } from '@phosphor-icons/react';
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

export default function MechanicListPanel({ mechanics, searchedArea, onSearch, onSelect, user, savedMechanics, onToggleSave, viewMode, searchRef, onDirection, hideOnDesktop, onUseMyLocation }) {
  const [searchTerm, setSearchTerm] = useState(searchedArea || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState('Services');
  const [currentSort, setCurrentSort] = useState('Near You');
  const [isScanning, setIsScanning] = useState(false);
  
  // --- Swipeable Bottom Sheet State ---
  const [sheetState, setSheetState] = useState('minimized'); // 'minimized', 'half', 'expanded'
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  const sortRef = useRef(null);
  const filterRef = useRef(null);
  const searchWrapperRef = useRef(null);

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

  const sortOptions = ['Near You', 'Top Rated', 'Most Popular', 'Open Now'];

  // Stop scanning once mechanics have distance data (location was obtained)
  useEffect(() => {
    if (isScanning && mechanics.some(m => m.distance)) {
      setIsScanning(false);
    }
  }, [mechanics, isScanning]);

  // Auto-stop scanning after 8s timeout as fallback
  useEffect(() => {
    if (!isScanning) return;
    const timer = setTimeout(() => setIsScanning(false), 8000);
    return () => clearTimeout(timer);
  }, [isScanning]);

  const handleScanLocation = () => {
    setIsScanning(true);
    if (onUseMyLocation) onUseMyLocation();
  };

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

        {/* Sticky "silver" search bar: sits in normal flow under the title at rest,
            then pins to the top of the scroll area once the title scrolls past it. */}
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
        <div className="list-meta">
          <span className="count">{mechanics.length} {viewMode === 'detailers' ? 'Detailers' : viewMode === 'fuel' ? 'Fuel Stations' : viewMode === 'shop' ? 'Auto Parts Dealers' : 'Mechanics'} · {viewMode === 'saved' ? 'Saved' : 'Near You'}</span>
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

                  const floorToRange = (t) => {
                    if (t <= 10) return '5–10';
                    if (t <= 20) return '10–20';
                    if (t <= 30) return '20–30';
                    if (t <= 40) return '30–40';
                    if (t <= 50) return '40–50';
                    return '50–60';
                  };

                  const minRange = floorToRange(minT);
                  const maxRange = floorToRange(maxT);

                  if (minRange === maxRange) return `${prefix} ${minRange} minutes drive from you`;
                  return `${prefix} ${minRange} to ${maxRange} minutes drive from you`;
                }
                return 'Allow location access to see driving times';
              })()
              )}
            </p>
          </div>
        </div>

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
        {mechanics.map((m) => {
          const featuredProducts = (m.products || []).slice(0, 3);
          const showFeatured = viewMode === 'shop' && featuredProducts.length > 0;

          return (
          <div key={m.id} className="mechanic-card" onClick={() => onSelect(m)}>
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
                      <span>{m.distance || '--'}</span>
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
                    className="card-bottom-action"
                    onClick={(e) => { e.stopPropagation(); onDirection(m); }}
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
                  <div className="card-header">
                    <h3 className="card-name">{m.name}</h3>
                    <p className="card-area">{m.area}{m.distance ? ` · ${m.distance} away` : ''}</p>
                  </div>

                  {!showFeatured && viewMode !== 'detailers' && (
                    <p className="card-specialty">{m.specialty || 'General Repairs'}</p>
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
                    className="card-bottom-action"
                    onClick={(e) => { e.stopPropagation(); onDirection(m); }}
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
