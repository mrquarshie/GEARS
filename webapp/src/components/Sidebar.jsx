import React from 'react';
import {
  House,
  MagnifyingGlass,
  BookmarkSimple,
  ClockCounterClockwise,
  Bell,
  Gear,
  UserPlus,
  SignIn,
  SignOut,
  GasPump,
} from '@phosphor-icons/react';

// Custom Car Detailing / Body Repair Icon matching the user's uploaded image
const CarDetailingIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Left Car Front */}
    <path d="M2 16h2a2 2 0 0 0 4 0h2v-4c0-1.5-1-3-2-4H5L2 12v4z" />
    <circle cx="6" cy="16" r="1.5" fill="currentColor" />
    {/* Right Car Front */}
    <path d="M22 16h-2a2 2 0 0 1-4 0h-2v-4c0-1.5 1-3 2-4h3l3 4v4z" />
    <circle cx="18" cy="16" r="1.5" fill="currentColor" />
    {/* Spark / Explosion */}
    <path d="M12 3 l-1.5 2.5 l-2.5 -1.5 l 1.5 3 l-3 1 l 3 1.5 l-1 3 l 2.5 -2 l 2 2.5 l1.5-3 l3-1.5 l-3-1 l1-2.5 l-2.5 1.5 z" fill="currentColor" stroke="none" />
  </svg>
);

export default function Sidebar({ user, authReady, viewMode, setViewMode, openAuth, onSignOut, isOpen, setIsOpen, onSearchClick }) {
  // Get initials from display name or email
  const getInitial = () => {
    if (!user) return null;
    if (user.displayName && user.displayName.trim()) {
      return user.displayName.trim()[0].toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return '?';
  };

  const initial = getInitial();

  const handleNavClick = (mode) => {
    setViewMode(mode);
    setIsOpen(false);
  };

  const handleSearchClick = () => {
    setIsOpen(false);
    if (onSearchClick) onSearchClick();
  };

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)}></div>}
      <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top">
          {/* Logo */}
          <div className="sidebar-logo">
            <a className="brand-logo" href="/">
              <div className="sidebar-logo-box">
                <Gear size={22} color="var(--lime)" weight="fill" />
              </div>
            </a>
          </div>

          <div className="sidebar-divider"></div>

          {/* Nav icons */}
          <nav className="sidebar-nav">
            <button
              className={`nav-btn ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => handleNavClick('all')}
              title="Home"
            >
              <House size={20} weight={viewMode === 'all' ? 'fill' : 'regular'} />
              <span className="nav-text">Home</span>
            </button>
            <button className="nav-btn" title="Search" onClick={handleSearchClick}>
              <MagnifyingGlass size={20} />
              <span className="nav-text">Search</span>
            </button>
            <button 
              className={`nav-btn ${viewMode === 'detailers' ? 'active' : ''}`} 
              title="Detailers" 
              onClick={() => handleNavClick('detailers')}
            >
              <CarDetailingIcon size={20} />
              <span className="nav-text">Detailers</span>
            </button>
            <button
              className={`nav-btn ${viewMode === 'fuel' ? 'active' : ''}`}
              title="Fuel Stations"
              onClick={() => handleNavClick('fuel')}
            >
              <GasPump size={20} weight={viewMode === 'fuel' ? 'fill' : 'regular'} />
              <span className="nav-text">Fuel Stations</span>
            </button>
            <button
              className={`nav-btn ${viewMode === 'saved' ? 'active' : ''}`}
              onClick={() => handleNavClick('saved')}
              title="Saved"
            >
              <BookmarkSimple size={20} weight={viewMode === 'saved' ? 'fill' : 'regular'} />
              <span className="nav-text">Saved</span>
            </button>
            <button className="nav-btn" title="History" onClick={() => setIsOpen(false)}>
              <ClockCounterClockwise size={20} />
              <span className="nav-text">History</span>
            </button>
            <button className="nav-btn" title="Notifications" onClick={() => setIsOpen(false)}>
              <Bell size={20} />
              <span className="nav-text">Notifications</span>
            </button>
          </nav>
        </div>

        {/* Bottom: auth section */}
        <div className="sidebar-bottom">
          {!authReady ? (
            <div style={{ width: 44, height: 44 }} />
          ) : user ? (
            <>
              <div className="sidebar-avatar" title={user.displayName || user.email}>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="avatar" className="sidebar-avatar-img" referrerPolicy="no-referrer" />
                ) : (
                  <span className="sidebar-avatar-letter">{initial}</span>
                )}
              </div>
              <button className="auth-btn" onClick={() => { onSignOut(); setIsOpen(false); }} title="Sign Out">
                <SignOut size={22} />
                <span className="nav-text">Sign Out</span>
              </button>
            </>
          ) : (
            <>
              <button className="auth-btn primary" onClick={() => { openAuth(); setIsOpen(false); }} title="Sign Up">
                <UserPlus size={22} />
                <span className="nav-text">Sign Up</span>
              </button>
              <button className="auth-btn" onClick={() => { openAuth(); setIsOpen(false); }} title="Log In">
                <SignIn size={22} />
                <span className="nav-text">Log In</span>
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
