import React from 'react';

export function IconShell({
  size,
  defaultSize,
  viewBox,
  state = 'default',
  filled = false,
  className = '',
  title,
  color,
  children,
  ...props
}) {
  const isFilled = filled || state === 'filled' || state === 'active' || state === 'clicked';
  const iconSize = size ?? defaultSize;
  const classes = [
    'gears-icon',
    `gears-icon--${state}`,
    isFilled ? 'gears-icon--filled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={iconSize}
      height={iconSize}
      viewBox={viewBox}
      fill="none"
      color={color}
      className={classes}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...props}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}
