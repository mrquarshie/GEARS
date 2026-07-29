import React from 'react';
import { IconShell } from './IconShell';
import './Icons.css';

export default function FilterIcon({ size = 24, state = 'default', filled = false, className = '', title, ...props }) {
  return (
    <IconShell
      size={size}
      defaultSize={"24"}
      viewBox="0 0 24 24"
      state={state}
      filled={filled}
      className={className}
      title={title}
      {...props}
    >
      <path d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z" stroke="currentColor" strokeOpacity={0.6} strokeLinecap="round" strokeLinejoin="round"/>
    </IconShell>
  );
}
