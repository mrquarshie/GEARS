import React from 'react';

// The one close (X) button design used everywhere a "close this" control is
// needed — same icon, same white circle + shadow treatment as the business
// profile panel's close button. `className` adds only positioning (e.g.
// `position: absolute; top; right;`) for the context it's used in; never
// override the visual treatment itself (background/shape/icon) per-site.
export default function CloseButton({ onClick, className = '', label = 'Close' }) {
  return (
    <button type="button" className={`gears-close-btn ${className}`} onClick={onClick} aria-label={label}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.33073 15.8334L4.16406 14.6667L8.83073 10.0001L4.16406 5.33341L5.33073 4.16675L9.9974 8.83341L14.6641 4.16675L15.8307 5.33341L11.1641 10.0001L15.8307 14.6667L14.6641 15.8334L9.9974 11.1667L5.33073 15.8334Z" fill="#1D1B20"/></svg>
    </button>
  );
}
