import React from 'react';
import {
  Gear,
  UserPlus,
  SignIn,
  SignOut,
} from '@phosphor-icons/react';
import {
  HomeIcon,
  ShopIcon,
  CarDetailingIcon,
  FillingStationIcon,
  BookmarkIcon,
  HistoryIcon,
  NotificationIcon,
} from './icons';

export default function Sidebar({ user, authReady, viewMode, setViewMode, openAuth, onSignOut, isOpen, setIsOpen, isSearchPanelOpen, onCloseSearch, onCloseDetail }) {
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
    if (isSearchPanelOpen && onCloseSearch) onCloseSearch();
    if (onCloseDetail) onCloseDetail();
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
                <Gear size={22} color="var(--lime)" weight="fill" className="logo-gear-spin" />
              </div>
            </a>
          </div>

          <div className="sidebar-divider"></div>

          {/* Nav icons */}
          <nav className="sidebar-nav">
            <button
              className={`nav-btn ${viewMode === 'all' && !isSearchPanelOpen ? 'active' : ''}`}
              onClick={() => handleNavClick('all')}
              title="Home"
            >
              <HomeIcon size={20} state={viewMode === 'all' && !isSearchPanelOpen ? 'filled' : 'default'} />
              <span className="nav-text">Home</span>
            </button>
            <button
              className={`nav-btn ${viewMode === 'shop' && !isSearchPanelOpen ? 'active' : ''}`}
              title="Auto Parts Dealers"
              onClick={() => handleNavClick('shop')}
            >
              <ShopIcon size={20} state={viewMode === 'shop' && !isSearchPanelOpen ? 'filled' : 'default'} />
              <span className="nav-text">Auto Parts Dealers</span>
            </button>
            <button
              className={`nav-btn ${viewMode === 'detailers' && !isSearchPanelOpen ? 'active' : ''}`}
              title="Detailers"
              onClick={() => handleNavClick('detailers')}
            >
              <CarDetailingIcon size={20} state={viewMode === 'detailers' && !isSearchPanelOpen ? 'filled' : 'default'} />
              <span className="nav-text">Detailers</span>
            </button>
            <button
              className={`nav-btn ${viewMode === 'fuel' && !isSearchPanelOpen ? 'active' : ''}`}
              title="Fuel Stations"
              onClick={() => handleNavClick('fuel')}
            >
              <FillingStationIcon size={20} state={viewMode === 'fuel' && !isSearchPanelOpen ? 'filled' : 'default'} />
              <span className="nav-text">Fuel Stations</span>
            </button>
            <button
              className={`nav-btn ${viewMode === 'saved' && !isSearchPanelOpen ? 'active' : ''}`}
              onClick={() => handleNavClick('saved')}
              title="Bookmarks"
            >
              <BookmarkIcon size={20} state={viewMode === 'saved' && !isSearchPanelOpen ? 'filled' : 'default'} />
              <span className="nav-text">Bookmarks</span>
            </button>
            <button
              className={`nav-btn ${viewMode === 'history' && !isSearchPanelOpen ? 'active' : ''}`}
              title="History"
              onClick={() => handleNavClick('history')}
            >
              <HistoryIcon size={20} state={viewMode === 'history' && !isSearchPanelOpen ? 'filled' : 'default'} />
              <span className="nav-text">History</span>
            </button>
            <button className="nav-btn" title="Notifications" onClick={() => setIsOpen(false)}>
              <NotificationIcon size={20} />
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
