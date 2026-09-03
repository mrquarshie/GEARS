import React from 'react';
import {
  UserPlus,
  SignOut,
  Storefront,
} from '@phosphor-icons/react';
import {
  HomeIcon,
  ShopIcon,
  CarDetailingIcon,
  FillingStationIcon,
  BookmarkIcon,
  HistoryIcon,
  NotificationIcon,
  GearsLogoMark,
} from './icons';
import { vibrateTap } from '../utils/feedback';

export default function Sidebar({ user, authReady, viewMode, setViewMode, openAuth, onSignOut, onOpenBusiness, myBusiness, isOpen, setIsOpen, isSearchPanelOpen, onCloseSearch, onCloseDetail }) {
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
  const userAlias = user
    ? (user.displayName?.trim() || user.email?.split('@')[0] || 'User')
    : null;

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
                <GearsLogoMark size={22} color="var(--lime)" className="logo-gear-spin" />
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
            <button
              className={`nav-btn ${viewMode === 'notifications' && !isSearchPanelOpen ? 'active' : ''}`}
              title="Notifications"
              onClick={() => handleNavClick('notifications')}
            >
              <NotificationIcon size={20} state={viewMode === 'notifications' && !isSearchPanelOpen ? 'filled' : 'default'} />
              <span className="nav-text">Notifications</span>
            </button>
          </nav>
        </div>

        {/* Bottom: auth section */}
        <div className="sidebar-bottom">
          <div className="sidebar-section-label">Accounts</div>
          {myBusiness ? (
            <button
              className="nav-btn business-nav-btn"
              title={`${myBusiness.name} · View Business`}
              onClick={() => { vibrateTap(); onOpenBusiness(); setIsOpen(false); }}
            >
              <div className="card-avatar sidebar-business-avatar">{myBusiness.name?.charAt(0)?.toUpperCase() || '?'}</div>
              <span className="nav-text">{myBusiness.name} · View Business</span>
            </button>
          ) : (
            <button
              className="nav-btn business-nav-btn"
              title="Become a Business"
              onClick={() => { vibrateTap(); onOpenBusiness(); setIsOpen(false); }}
            >
              <Storefront size={20} />
              <span className="nav-text">Become a Business</span>
            </button>
          )}
          {!authReady ? (
            <div style={{ width: 44, height: 44 }} />
          ) : user ? (
            <>
              <div
                className="sidebar-user-profile"
                title={`${userAlias} — Click to view your saved places`}
                onClick={() => handleNavClick('saved')}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
              >
                <div className="sidebar-avatar">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="avatar" className="sidebar-avatar-img" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="sidebar-avatar-letter">{initial}</span>
                  )}
                </div>
                <span className="nav-text sidebar-user-alias">{userAlias}</span>
              </div>
              <button className="auth-btn auth-btn--danger" onClick={() => { vibrateTap(); onSignOut(); setIsOpen(false); }} title="Log Out">
                <SignOut size={22} />
                <span className="nav-text">Log Out</span>
              </button>
            </>
          ) : (
            // One button, not two — Google's own popup already handles
            // whether the email is new or existing, so a separate "Sign Up"
            // vs "Log In" button would just open the identical flow twice.
            <button className="auth-btn primary" onClick={() => { vibrateTap(); openAuth(); setIsOpen(false); }} title="Sign Up / Log In">
              <UserPlus size={22} />
              <span className="nav-text">Sign Up / Log In</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
