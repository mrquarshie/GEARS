import React from 'react';

export default function BookmarkIcon({ size = 20, state = 'default', filled = false, className = '', title, color = 'currentColor', ...props }) {
  const isFilled = filled || state === 'filled' || state === 'active';
  const fg = isFilled ? '#145E42' : color;
  const fgOpacity = isFilled ? undefined : 0.6;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...props}
    >
      {title && <title>{title}</title>}
      <path d="M12 3V14L8 11.5L4 14V3C4 2.86739 4.05268 2.74021 4.14645 2.64645C4.24021 2.55268 4.36739 2.5 4.5 2.5H11.5C11.6326 2.5 11.7598 2.55268 11.8536 2.64645C11.9473 2.74021 12 2.86739 12 3Z" fill={fg} fillOpacity={isFilled ? 1 : 0.2} />
      <path d="M11.5 2H4.5C4.23478 2 3.98043 2.10536 3.79289 2.29289C3.60536 2.48043 3.5 2.73478 3.5 3V14C3.50004 14.0892 3.52397 14.1768 3.56929 14.2537C3.6146 14.3306 3.67967 14.3939 3.75772 14.4371C3.83578 14.4804 3.92399 14.5019 4.01319 14.4996C4.10239 14.4972 4.18933 14.471 4.265 14.4237L8 12.0894L11.7356 14.4237C11.8113 14.4709 11.8982 14.4969 11.9873 14.4992C12.0764 14.5015 12.1645 14.4799 12.2424 14.4367C12.3204 14.3934 12.3854 14.3302 12.4307 14.2534C12.4759 14.1766 12.4999 14.0891 12.5 14V3C12.5 2.73478 12.3946 2.48043 12.2071 2.29289C12.0196 2.10536 11.7652 2 11.5 2ZM11.5 13.0981L8.26437 11.0763C8.18491 11.0266 8.09308 11.0002 7.99937 11.0002C7.90566 11.0002 7.81384 11.0266 7.73438 11.0763L4.5 13.0981V3H11.5V13.0981Z" fill={fg} fillOpacity={fgOpacity} />
    </svg>
  );
}
