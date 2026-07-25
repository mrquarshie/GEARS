import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MagnifyingGlass, Faders, BookmarkSimple, Star, ShareNetwork, MapPin, Phone, Target, GasPump } from '@phosphor-icons/react';

export default function MechanicListPanel({ mechanics, searchedArea, onSearch, onSelect, user, savedMechanics, onToggleSave, viewMode, searchRef }) {
  const [searchTerm, setSearchTerm] = useState(searchedArea || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState('Services');
  const [currentSort, setCurrentSort] = useState('Near You');
  
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

  const sortOptions = ['Near You', 'Top Rated', 'Most Popular', 'Open Now'];

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
  if (sheetState === 'expanded') transformBase = '0px';

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const dynamicStyle = isMobile ? {
    transform: `translateY(calc(${transformBase} + ${dragOffset}px))`
  } : {};

  return (
    <div 
      className={`mechanic-list-panel ${isDragging ? 'dragging' : ''}`}
      style={dynamicStyle}
    >
      <div 
        className="list-header"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mobile-drag-handle"></div>
        <h1>
          {viewMode === 'detailers' ? (
            <>A Car Detailer,<br />When You Need One.</>
          ) : viewMode === 'fuel' ? (
            <>Find Fuel Stations<br />Near You</>
          ) : (
            <>A Mechanic,<br />When You Need One.</>
          )}
        </h1>
        <form className="search-bar-wrapper" onSubmit={handleSearchSubmit} ref={searchWrapperRef}>
          <div className="search-input-box">
            <MagnifyingGlass size={18} className="search-icon" weight="bold" />
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
                  <MagnifyingGlass size={14} className="suggestion-icon" />
                  <span className="suggestion-text">{s.value}</span>
                  <span className="suggestion-type">{s.type}</span>
                </div>
              ))}
            </div>
          )}

          <div className="filter-container" ref={filterRef}>
            <button type="button" className="filter-btn" onClick={() => setIsFilterOpen(!isFilterOpen)}>
              <Faders size={18} />
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
            )}
          </div>
        </form>
        <div className="list-meta">
          <span className="count">{mechanics.length} {viewMode === 'detailers' ? 'DETAILERS' : viewMode === 'fuel' ? 'FUEL STATIONS' : 'MECHANICS'} · {viewMode === 'saved' ? 'SAVED' : 'NEAR YOU'}</span>
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

        <div className="location-banner">
          <div className="location-icon-wrapper">
            {viewMode === 'fuel' ? (
              <GasPump size={20} weight="fill" color="var(--forest)" />
            ) : (
              <MapPin size={20} weight="fill" color="var(--forest)" />
            )}
          </div>
          <div className="location-banner-text">
            <h4>{viewMode === 'fuel' ? 'Fuel Delivery' : 'Use my location to find the mechanics'}</h4>
            <p>
              {(() => {
                const validTimes = mechanics.map(m => m.timeInMinutes).filter(t => t != null);
                if (validTimes.length > 0) {
                  const minT = Math.max(1, Math.floor(Math.min(...validTimes)));
                  const maxT = Math.ceil(Math.max(...validTimes));
                  const prefix = viewMode === 'fuel' ? 'All fuel stations' : 'All Mechanics';
                  if (minT === maxT) return `${prefix} ~${minT} minutes drive from you`;
                  return `${prefix} ${minT} - ${maxT} minutes drive from you`;
                }
                return 'Allow location access to see driving times';
              })()}
            </p>
          </div>
        </div>
      </div>

      <div className="mechanic-cards">
        {mechanics.map((m) => (
          <div key={m.id} className="mechanic-card" onClick={() => onSelect(m)}>
            <div className="card-top">
              <div className="avatar-placeholder" style={viewMode === 'fuel' && (m.name.toLowerCase().includes('shell') || m.name.toLowerCase().includes('goil')) ? { background: 'transparent' } : {}}>
                {viewMode === 'fuel' && m.name.toLowerCase().includes('shell') ? (
                  <img src="https://upload.wikimedia.org/wikipedia/en/thumb/e/e8/Shell_logo.svg/100px-Shell_logo.svg.png" alt="Shell" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
                ) : viewMode === 'fuel' && m.name.toLowerCase().includes('goil') ? (
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Goil_Logo.svg/100px-Goil_Logo.svg.png" alt="Goil" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
                ) : (
                  <span className="avatar-letter">{m.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="card-top-right">
                <span className="distance"><MapPin size={12} weight="fill" /> {m.distance ? m.distance : '--'}</span>
                {viewMode !== 'fuel' && <span className="rating-badge">{m.rating !== 'New' ? Number(m.rating).toFixed(1) : 'New'} <Star size={10} weight="fill" /></span>}
                {viewMode !== 'fuel' && <span className="status-badge">Open</span>}
              </div>
            </div>
            
            <h3 className="mechanic-name">{m.name}</h3>
            <p className="mechanic-area">{m.area}</p>
            
            {viewMode === 'fuel' ? (
              <div className="fuel-prices" style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--muted)', marginTop: '8px', marginBottom: '8px' }}>
                <span>Petrol - <span style={{ color: 'var(--text)', fontWeight: 600 }}>¢14.65</span></span>
                <span>Diesel - <span style={{ color: 'var(--text)', fontWeight: 600 }}>¢15.08</span></span>
              </div>
            ) : (
              <p className="mechanic-specialty">⚙ {m.specialty || 'General Repairs'}</p>
            )}
            
            {viewMode === 'detailers' && (
              <div className="detailer-thumbnails">
                <div className="thumbnail-block"></div>
                <div className="thumbnail-block"></div>
                <div className="thumbnail-block"></div>
              </div>
            )}
            
            <div className="card-actions">
              <div className="icon-group">
                <button 
                  className={`icon-btn ${savedMechanics.includes(m.id) ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleSave(m); }}
                >
                  <BookmarkSimple size={16} weight={savedMechanics.includes(m.id) ? "fill" : "regular"} color={savedMechanics.includes(m.id) ? 'var(--forest)' : 'currentColor'} />
                </button>
                {viewMode !== 'fuel' && <button className="icon-btn"><Star size={16} /></button>}
                {viewMode !== 'fuel' && <button className="icon-btn"><ShareNetwork size={16} /></button>}
              </div>
              <div className="action-group">
                <a 
                  className="action-btn"
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat && m.lng ? `${m.lat},${m.lng}` : encodeURIComponent(`${m.name} ${m.area}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MapPin size={14} /> Direction
                </a>
                {viewMode === 'fuel' ? (
                  <button className="action-btn outline" style={{ cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
                    <GasPump size={14} /> Delivery <span style={{ background: '#fff0e6', color: '#ff8a4c', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', marginLeft: '4px', fontWeight: 600 }}>Soon</span>
                  </button>
                ) : (
                  <button 
                    className="action-btn outline" 
                    onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${m.phone.replace(/\s+/g, '')}`; }}
                  >
                    <Phone size={14} /> Call
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
