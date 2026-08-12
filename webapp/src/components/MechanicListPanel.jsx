import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Target, ArrowLeft, X, Wrench } from '@phosphor-icons/react';
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
import { getPlaceholderPhrases } from '../searchPlaceholders';
import { useTypewriterPlaceholder } from '../hooks/useTypewriterPlaceholder';
import { useTypewriterLoop } from '../hooks/useTypewriterLoop';
import { ItemSheet } from './MechanicDetailPanel';
import { getRecentInteraction, formatRelativeTime } from '../recentInteractions';

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

const INTERACTION_LABELS = {
  call: 'Called',
  bookmark: 'Bookmarked',
  direction: 'Direction',
  rate: 'Rated',
};

function InteractionBadge({ action, timestamp }) {
  const label = INTERACTION_LABELS[action];
  if (!label) return null;
  return (
    <div className="card-interaction-badge">
      {action === 'call' && <CallIcon size={16} />}
      {action === 'bookmark' && <BookmarkIcon size={16} state="filled" />}
      {action === 'direction' && <LocationIcon size={16} state="filled" />}
      {action === 'rate' && <RateIcon size={16} />}
      <div className="card-interaction-badge-text">
        <span className="card-interaction-badge-label">{label}</span>
        <span className="card-interaction-badge-time">{formatRelativeTime(timestamp)}</span>
      </div>
    </div>
  );
}

// Types out each specialty one after the other, holding 7s each — the same
// typewriter animation used by the search placeholder.
function SpecialtyTypewriter({ specialties }) {
  const text = useTypewriterLoop(specialties, { holdMs: 7000 });
  return (
    <span className="specialty-typewriter">
      <span className="specialty-typewriter-text">{text}</span>
      <span className="specialty-typewriter-cursor">|</span>
    </span>
  );
}

// When a search matched a mechanic via one of its products or services (rather
// than its name/area/specialty), return that matched item so the card can show
// it in place of the specialty.
function findProductServiceMatch(mechanic, term) {
  if (!term) return null;
  const t = term.toLowerCase();
  const product = (mechanic.products || []).find(p => p.name?.toLowerCase().includes(t));
  if (product) return { type: 'product', label: product.name, price: product.price };
  const service = (mechanic.services || []).find(s => {
    const name = typeof s === 'string' ? s : s.name;
    return name?.toLowerCase().includes(t);
  });
  if (service) {
    const name = typeof service === 'string' ? service : service.name;
    const price = typeof service === 'string' ? undefined : service.price;
    return { type: 'service', label: name, price };
  }
  return null;
}

const BENTO_CARD_COUNT = 3;

function useBentoRevealLoop(active) {
  const [filledCount, setFilledCount] = useState(0);

  useEffect(() => {
    if (!active) {
      setFilledCount(0);
      return;
    }

    let cancelled = false;
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    (async () => {
      while (!cancelled) {
        setFilledCount(0);
        await wait(600);
        for (let i = 1; i <= 3; i++) {
          if (cancelled) return;
          setFilledCount(i);
          await wait(600);
        }
        if (cancelled) return;
        await wait(800);
      }
    })();

    return () => { cancelled = true; };
  }, [active]);

  return { filledCount };
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

function getVerificationTier(mechanic) {
  if (mechanic.verified) return 1;
  if (mechanic.claimed) return 2;
  return 3;
}

function VerifiedIcon({ size = 20 }) {
  return (
    <svg width={20} height={20} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.2" d="M14.5 8C14.5 8.78188 13.3863 9.37188 13.0825 10.1056C12.79 10.8131 13.1712 12.0212 12.5962 12.5962C12.0212 13.1712 10.8131 12.79 10.1056 13.0825C9.375 13.3863 8.78125 14.5 8 14.5C7.21875 14.5 6.625 13.3863 5.89437 13.0825C5.18687 12.79 3.97875 13.1712 3.40375 12.5962C2.82875 12.0212 3.21 10.8131 2.9175 10.1056C2.61375 9.375 1.5 8.78125 1.5 8C1.5 7.21875 2.61375 6.625 2.9175 5.89437C3.21 5.1875 2.82875 3.97875 3.40375 3.40375C3.97875 2.82875 5.1875 3.21 5.89437 2.9175C6.62812 2.61375 7.21875 1.5 8 1.5C8.78125 1.5 9.375 2.61375 10.1056 2.9175C10.8131 3.21 12.0212 2.82875 12.5962 3.40375C13.1712 3.97875 12.79 5.18687 13.0825 5.89437C13.3863 6.62812 14.5 7.21875 14.5 8Z" fill="#145E42" />
      <path d="M14.1163 6.42625C13.8806 6.18 13.6369 5.92625 13.545 5.70312C13.46 5.49875 13.455 5.16 13.45 4.83187C13.4406 4.22187 13.4306 3.53062 12.95 3.05C12.4694 2.56937 11.7781 2.55937 11.1681 2.55C10.84 2.545 10.5012 2.54 10.2969 2.455C10.0744 2.36312 9.82 2.11937 9.57375 1.88375C9.1425 1.46937 8.6525 1 8 1C7.3475 1 6.85812 1.46937 6.42625 1.88375C6.18 2.11937 5.92625 2.36312 5.70312 2.455C5.5 2.54 5.16 2.545 4.83187 2.55C4.22187 2.55937 3.53062 2.56937 3.05 3.05C2.56937 3.53062 2.5625 4.22187 2.55 4.83187C2.545 5.16 2.54 5.49875 2.455 5.70312C2.36312 5.92562 2.11937 6.18 1.88375 6.42625C1.46937 6.8575 1 7.3475 1 8C1 8.6525 1.46937 9.14187 1.88375 9.57375C2.11937 9.82 2.36312 10.0738 2.455 10.2969C2.54 10.5012 2.545 10.84 2.55 11.1681C2.55937 11.7781 2.56937 12.4694 3.05 12.95C3.53062 13.4306 4.22187 13.4406 4.83187 13.45C5.16 13.455 5.49875 13.46 5.70312 13.545C5.92562 13.6369 6.18 13.8806 6.42625 14.1163C6.8575 14.5306 7.3475 15 8 15C8.6525 15 9.14187 14.5306 9.57375 14.1163C9.82 13.8806 10.0738 13.6369 10.2969 13.545C10.5012 13.46 10.84 13.455 11.1681 13.45C11.7781 13.4406 12.4694 13.4306 12.95 12.95C13.4306 12.4694 13.4406 11.7781 13.45 11.1681C13.455 10.84 13.46 10.5012 13.545 10.2969C13.6369 10.0744 13.8806 9.82 14.1163 9.57375C14.5306 9.1425 15 8.6525 15 8C15 7.3475 14.5306 6.85812 14.1163 6.42625ZM13.3944 8.88188C13.095 9.19438 12.785 9.5175 12.6206 9.91438C12.4631 10.2956 12.4562 10.7312 12.45 11.1531C12.4437 11.5906 12.4369 12.0488 12.2425 12.2425C12.0481 12.4363 11.5931 12.4437 11.1531 12.45C10.7312 12.4562 10.2956 12.4631 9.91438 12.6206C9.5175 12.785 9.19438 13.095 8.88188 13.3944C8.56938 13.6937 8.25 14 8 14C7.75 14 7.42812 13.6925 7.11812 13.3944C6.80812 13.0962 6.4825 12.785 6.08563 12.6206C5.70438 12.4631 5.26875 12.4562 4.84688 12.45C4.40938 12.4437 3.95125 12.4369 3.7575 12.2425C3.56375 12.0481 3.55625 11.5931 3.55 11.1531C3.54375 10.7312 3.53687 10.2956 3.37937 9.91438C3.215 9.5175 2.905 9.19438 2.60562 8.88188C2.30625 8.56938 2 8.25 2 8C2 7.75 2.3075 7.42812 2.60562 7.11812C2.90375 6.80812 3.215 6.4825 3.37937 6.08563C3.53687 5.70438 3.54375 5.26875 3.55 4.84688C3.55625 4.40938 3.56312 3.95125 3.7575 3.7575C3.95187 3.56375 4.40688 3.55625 4.84688 3.55C5.26875 3.54375 5.70438 3.53687 6.08563 3.37937C6.4825 3.215 6.80562 2.905 7.11812 2.60562C7.43062 2.30625 7.75 2 8 2C8.25 2 8.57188 2.3075 8.88188 2.60562C9.19188 2.90375 9.5175 3.215 9.91438 3.37937C10.2956 3.53687 10.7312 3.54375 11.1531 3.55C11.5906 3.55625 12.0488 3.56312 12.2425 3.7575C12.4363 3.95187 12.4437 4.40688 12.45 4.84688C12.4562 5.26875 12.4631 5.70438 12.6206 6.08563C12.785 6.4825 13.095 6.80562 13.3944 7.11812C13.6937 7.43062 14 7.75 14 8C14 8.25 13.6925 8.57188 13.3944 8.88188ZM10.8538 6.14625C10.9002 6.19269 10.9371 6.24783 10.9623 6.30853C10.9874 6.36923 11.0004 6.43429 11.0004 6.5C11.0004 6.56571 10.9874 6.63077 10.9623 6.69147C10.9371 6.75217 10.9002 6.80731 10.8538 6.85375L7.35375 10.3538C7.30731 10.4002 7.25217 10.4371 7.19147 10.4623C7.13077 10.4874 7.06571 10.5004 7 10.5004C6.93429 10.5004 6.86923 10.4874 6.80853 10.4623C6.74783 10.4371 6.69269 10.4002 6.64625 10.3538L5.14625 8.85375C5.05243 8.75993 4.99972 8.63268 4.99972 8.5C4.99972 8.36732 5.05243 8.24007 5.14625 8.14625C5.24007 8.05243 5.36732 7.99972 5.5 7.99972C5.63268 7.99972 5.75993 8.05243 5.85375 8.14625L7 9.29313L10.1462 6.14625C10.1927 6.09976 10.2478 6.06288 10.3085 6.03772C10.3692 6.01256 10.4343 5.99961 10.5 5.99961C10.5657 5.99961 10.6308 6.01256 10.6915 6.03772C10.7522 6.06288 10.8073 6.09976 10.8538 6.14625Z" fill="#145E42" />
    </svg>
  );
}

function ClaimedIcon({ size = 20 }) {
  return (
    <svg width={20} height={20} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.2" d="M14.5 8C14.5 8.78188 13.3863 9.37188 13.0825 10.1056C12.79 10.8131 13.1712 12.0212 12.5962 12.5962C12.0212 13.1712 10.8131 12.79 10.1056 13.0825C9.375 13.3863 8.78125 14.5 8 14.5C7.21875 14.5 6.625 13.3863 5.89437 13.0825C5.18687 12.79 3.97875 13.1712 3.40375 12.5962C2.82875 12.0212 3.21 10.8131 2.9175 10.1056C2.61375 9.375 1.5 8.78125 1.5 8C1.5 7.21875 2.61375 6.625 2.9175 5.89437C3.21 5.1875 2.82875 3.97875 3.40375 3.40375C3.97875 2.82875 5.1875 3.21 5.89437 2.9175C6.62812 2.61375 7.21875 1.5 8 1.5C8.78125 1.5 9.375 2.61375 10.1056 2.9175C10.8131 3.21 12.0212 2.82875 12.5962 3.40375C13.1712 3.97875 12.79 5.18687 13.0825 5.89437C13.3863 6.62812 14.5 7.21875 14.5 8Z" fill="black" fillOpacity="0.4" />
      <path d="M14.1163 6.42625C13.8806 6.18 13.6369 5.92625 13.545 5.70312C13.46 5.49875 13.455 5.16 13.45 4.83187C13.4406 4.22187 13.4306 3.53062 12.95 3.05C12.4694 2.56937 11.7781 2.55937 11.1681 2.55C10.84 2.545 10.5012 2.54 10.2969 2.455C10.0744 2.36312 9.82 2.11937 9.57375 1.88375C9.1425 1.46937 8.6525 1 8 1C7.3475 1 6.85812 1.46937 6.42625 1.88375C6.18 2.11937 5.92625 2.36312 5.70312 2.455C5.5 2.54 5.16 2.545 4.83187 2.55C4.22187 2.55937 3.53062 2.56937 3.05 3.05C2.56937 3.53062 2.5625 4.22187 2.55 4.83187C2.545 5.16 2.54 5.49875 2.455 5.70312C2.36312 5.92562 2.11937 6.18 1.88375 6.42625C1.46937 6.8575 1 7.3475 1 8C1 8.6525 1.46937 9.14187 1.88375 9.57375C2.11937 9.82 2.36312 10.0738 2.455 10.2969C2.54 10.5012 2.545 10.84 2.55 11.1681C2.55937 11.7781 2.56937 12.4694 3.05 12.95C3.53062 13.4306 4.22187 13.4406 4.83187 13.45C5.16 13.455 5.49875 13.46 5.70312 13.545C5.92562 13.6369 6.18 13.8806 6.42625 14.1163C6.8575 14.5306 7.3475 15 8 15C8.6525 15 9.14187 14.5306 9.57375 14.1163C9.82 13.8806 10.0738 13.6369 10.2969 13.545C10.5012 13.46 10.84 13.455 11.1681 13.45C11.7781 13.4406 12.4694 13.4306 12.95 12.95C13.4306 12.4694 13.4406 11.7781 13.45 11.1681C13.455 10.84 13.46 10.5012 13.545 10.2969C13.6369 10.0744 13.8806 9.82 14.1163 9.57375C14.5306 9.1425 15 8.6525 15 8C15 7.3475 14.5306 6.85812 14.1163 6.42625ZM13.3944 8.88188C13.095 9.19438 12.785 9.5175 12.6206 9.91438C12.4631 10.2956 12.4562 10.7312 12.45 11.1531C12.4437 11.5906 12.4369 12.0488 12.2425 12.2425C12.0481 12.4363 11.5931 12.4437 11.1531 12.45C10.7312 12.4562 10.2956 12.4631 9.91438 12.6206C9.5175 12.785 9.19438 13.095 8.88188 13.3944C8.56938 13.6937 8.25 14 8 14C7.75 14 7.42812 13.6925 7.11812 13.3944C6.80812 13.0962 6.4825 12.785 6.08563 12.6206C5.70438 12.4631 5.26875 12.4562 4.84688 12.45C4.40938 12.4437 3.95125 12.4369 3.7575 12.2425C3.56375 12.0481 3.55625 11.5931 3.55 11.1531C3.54375 10.7312 3.53687 10.2956 3.37937 9.91438C3.215 9.5175 2.905 9.19438 2.60562 8.88188C2.30625 8.56938 2 8.25 2 8C2 7.75 2.3075 7.42812 2.60562 7.11812C2.90375 6.80812 3.215 6.4825 3.37937 6.08563C3.53687 5.70438 3.54375 5.26875 3.55 4.84688C3.55625 4.40938 3.56312 3.95125 3.7575 3.7575C3.95187 3.56375 4.40688 3.55625 4.84688 3.55C5.26875 3.54375 5.70438 3.53687 6.08563 3.37937C6.4825 3.215 6.80562 2.905 7.11812 2.60562C7.43062 2.30625 7.75 2 8 2C8.25 2 8.57188 2.3075 8.88188 2.60562C9.19188 2.90375 9.5175 3.215 9.91438 3.37937C10.2956 3.53687 10.7312 3.54375 11.1531 3.55C11.5906 3.55625 12.0488 3.56312 12.2425 3.7575C12.4363 3.95187 12.4437 4.40688 12.45 4.84688C12.4562 5.26875 12.4631 5.70438 12.6206 6.08563C12.785 6.4825 13.095 6.80562 13.3944 7.11812C13.6937 7.43062 14 7.75 14 8C14 8.25 13.6925 8.57188 13.3944 8.88188ZM10.8538 6.14625C10.9002 6.19269 10.9371 6.24783 10.9623 6.30853C10.9874 6.36923 11.0004 6.43429 11.0004 6.5C11.0004 6.56571 10.9874 6.63077 10.9623 6.69147C10.9371 6.75217 10.9002 6.80731 10.8538 6.85375L7.35375 10.3538C7.30731 10.4002 7.25217 10.4371 7.19147 10.4623C7.13077 10.4874 7.06571 10.5004 7 10.5004C6.93429 10.5004 6.86923 10.4874 6.80853 10.4623C6.74783 10.4371 6.69269 10.4002 6.64625 10.3538L5.14625 8.85375C5.05243 8.75993 4.99972 8.63268 4.99972 8.5C4.99972 8.36732 5.05243 8.24007 5.14625 8.14625C5.24007 8.05243 5.36732 7.99972 5.5 7.99972C5.63268 7.99972 5.75993 8.05243 5.85375 8.14625L7 9.29313L10.1462 6.14625C10.1927 6.09976 10.2478 6.06288 10.3085 6.03772C10.3692 6.01256 10.4343 5.99961 10.5 5.99961C10.5657 5.99961 10.6308 6.01256 10.6915 6.03772C10.7522 6.06288 10.8073 6.09976 10.8538 6.14625Z" fill="black" fillOpacity="0.4" />
    </svg>
  );
}

function UnverifiedIcon({ size = 20 }) {
  return (
    <svg width={20} height={20} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="0.75" />
      <path d="M7.5 5v3.5M7.5 11h0.01" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

// The actual bucket search resolves almost instantly (location is usually already
// known), which makes the scanning UI flash by unnoticed. Force it to run for at
// least this long so the loading/radar sequence is actually visible.
const MIN_SCAN_MS = 3500;

export default function MechanicListPanel({ mechanics, searchedArea, onSearch, onSelect, user, savedMechanics, onToggleSave, viewMode, searchRef, onOpenSearch, onDirection, hideOnDesktop, onUseMyLocation, onScanStateChange, onNavigateHome, onOpenSidebar, recentInteractions, onRecordInteraction }) {
  const [searchTerm, setSearchTerm] = useState(searchedArea || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState('Services');
  const [selectedFilters, setSelectedFilters] = useState({
    services: [],
    availability: [],
    distance: null,
    rating: null,
  });
  const [currentSort, setCurrentSort] = useState('Near You');
  const [isScanning, setIsScanning] = useState(false);
  const [nearMeRange, setNearMeRange] = useState(null);
  const [bookmarkSubTab, setBookmarkSubTab] = useState('Mechanics');
  const [directionTargetId, setDirectionTargetId] = useState(null);
  // Mirrors the detail panel's collapsed peek bar: shrinks the whole list
  // sheet down to a small tracking bar so the route on the map is visible.
  const [directionPeek, setDirectionPeek] = useState(false);
  const [productSheet, setProductSheet] = useState(null); // { item, mechanicId, mechanicName, mechanicPhone }
  const [verificationSheet, setVerificationSheet] = useState(null);

  // --- Swipeable Bottom Sheet State ---
  const [sheetState, setSheetState] = useState('minimized'); // 'minimized', 'half', 'expanded'
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  const sortRef = useRef(null);
  const filterRef = useRef(null);
  const filterPopupRef = useRef(null);
  const searchWrapperRef = useRef(null);
  const panelRef = useRef(null);
  const scanStartRef = useRef(0);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const suggestions = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    const uniqueMatches = new Map();
    mechanics.forEach(m => {
      if (m.name?.toLowerCase().includes(term)) uniqueMatches.set(m.name, { type: 'Name', value: m.name });
      if (m.area?.toLowerCase().includes(term)) uniqueMatches.set(m.area, { type: 'Area', value: m.area });
      if (m.specialty?.toLowerCase().includes(term)) uniqueMatches.set(m.specialty, { type: 'Category', value: m.specialty });
      if (m.locationDetail?.toLowerCase().includes(term)) uniqueMatches.set(m.locationDetail, { type: 'Location', value: m.locationDetail });
      if (m.about?.toLowerCase().includes(term)) uniqueMatches.set(m.about, { type: 'About', value: m.about });
      (m.specialties || []).forEach(s => { if (s.toLowerCase().includes(term)) uniqueMatches.set(s, { type: 'Speciality', value: s }); });
      (m.services || []).forEach(s => {
        const serviceName = typeof s === 'string' ? s : s.name;
        if (serviceName?.toLowerCase().includes(term)) uniqueMatches.set(serviceName, { type: 'Service', value: serviceName });
      });
      (m.products || []).forEach(p => { if (p.name?.toLowerCase().includes(term)) uniqueMatches.set(p.name, { type: 'Product', value: p.name }); });
      (m.fuelPrices || []).forEach(f => { if (f.type?.toLowerCase().includes(term)) uniqueMatches.set(f.type, { type: 'Fuel', value: f.type }); });
      (m.facilities || []).forEach(f => { if (f.toLowerCase?.().includes(term)) uniqueMatches.set(f, { type: 'Facility', value: f }); });
      if (m.phone?.toLowerCase().includes(term)) uniqueMatches.set(m.phone, { type: 'Phone', value: m.phone });
    });
    return Array.from(uniqueMatches.values()).slice(0, 8);
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

  const placeholderPhrases = useMemo(() => getPlaceholderPhrases(viewMode), [viewMode]);
  const placeholderText = useTypewriterPlaceholder(placeholderPhrases);

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

  // Reset sheet to minimized when switching categories so the map is pannable.
  // (The animated placeholder resets itself when the phrase set changes.)
  useEffect(() => {
    setSheetState('minimized');
    setDragOffset(0);
    setSelectedFilters({ services: [], availability: [], distance: null, rating: null });
  }, [viewMode]);

  // Auto-expand the sheet when a search is applied — otherwise a result can
  // land mostly below the visible "minimized" peek, and reaching it means
  // dragging the handle up first (the sheet's own drag gesture, not a
  // scroll, only lives on that handle). Runs after the viewMode-reset
  // effect above so it wins when a smart-search redirect changes both at
  // once (e.g. searching a detailer's name while on the mechanics tab).
  useEffect(() => {
    if (searchedArea) setSheetState('expanded');
  }, [searchedArea]);

  // Let the map show a radar-scanning animation on the user's location dot while active.
  useEffect(() => {
    if (onScanStateChange) onScanStateChange(isScanning);
  }, [isScanning, onScanStateChange]);


  const handleScanLocation = () => {
    scanStartRef.current = Date.now();
    setIsScanning(true);
    if (onUseMyLocation) onUseMyLocation();
  };

  const displayedMechanics = useMemo(() => {
    let list;
    if (nearMeRange) {
      list = mechanics.filter(m => m.timeInMinutes != null && m.timeInMinutes <= nearMeRange.max);
    } else if (viewMode === 'saved') {
      list = bookmarkedMechanics;
    } else if (viewMode === 'history') {
      // Show only mechanics the user recently interacted with, most recent
      // first, filtered by the active sub-tab category (bookmarkedMechanics).
      const interacted = new Set(Object.keys(recentInteractions || {}));
      list = bookmarkedMechanics
        .filter(m => interacted.has(m.id))
        .sort((a, b) => (recentInteractions[b.id]?.timestamp || 0) - (recentInteractions[a.id]?.timestamp || 0));
    } else {
      list = mechanics;
    }

    const { services, availability, distance, rating } = selectedFilters;

    if (services.length > 0) {
      list = list.filter(m =>
        services.some(s => (m.services || []).some(ms => (typeof ms === 'string' ? ms : ms.name)?.toLowerCase().includes(s.toLowerCase())) ||
          (m.specialty || '').toLowerCase().includes(s.toLowerCase()))
      );
    }

    if (availability.length > 0) {
      list = list.filter(m => {
        return availability.some(a => {
          if (a === 'Open Now') return m.open === true;
          if (a === '24/7') return m.hours?.toLowerCase().includes('24');
          return true;
        });
      });
    }

    if (distance) {
      list = list.filter(m => {
        if (m.timeInMinutes == null) return false;
        if (distance === '1 km') return m.timeInMinutes <= 2;
        if (distance === '3 km') return m.timeInMinutes <= 6;
        if (distance === '5 km') return m.timeInMinutes <= 10;
        return true; // 10 km+
      });
    }

    if (rating) {
      list = list.filter(m => {
        const r = m.rating === 'New' ? 0 : Number(m.rating);
        if (rating === '4.0+') return r >= 4;
        if (rating === '4.5+') return r >= 4.5;
        return true; // Any
      });
    }

    return list;
  }, [mechanics, nearMeRange, viewMode, bookmarkedMechanics, selectedFilters, recentInteractions]);

  const sortedMechanics = useMemo(() => {
    if (viewMode === 'history') return displayedMechanics; // already sorted by recency
    return [...displayedMechanics].sort((a, b) => getVerificationTier(a) - getVerificationTier(b));
  }, [displayedMechanics, viewMode]);

  const activeFilterCount = selectedFilters.services.length + selectedFilters.availability.length + (selectedFilters.distance ? 1 : 0) + (selectedFilters.rating ? 1 : 0);

  const carouselCardData = useMemo(() => {
    const sets = {
      all: [
        { area: 'Osu, Accra', specialty: 'General Repairs', icon: <Wrench size={12} weight="bold" /> },
        { area: 'Adum, Kumasi', specialty: 'Diagnostics', icon: <Wrench size={12} weight="bold" /> },
        { area: 'Tema Community 1', specialty: 'Engine Repair', icon: <Wrench size={12} weight="bold" /> },
      ],
      detailers: [
        { area: 'Airport, Accra', specialty: 'Full Detailing', icon: <Wrench size={12} weight="bold" /> },
        { area: 'East Legon', specialty: 'Paint Correction', icon: <Wrench size={12} weight="bold" /> },
        { area: 'Labone, Accra', specialty: 'Ceramic Coating', icon: <Wrench size={12} weight="bold" /> },
      ],
      fuel: [
        { area: 'Spintex, Accra', specialty: 'Petrol & Diesel', icon: <FillingStationIcon size={12} color="var(--forest)" /> },
        { area: 'Madina, Accra', specialty: 'LPG Gas', icon: <FillingStationIcon size={12} color="var(--forest)" /> },
        { area: 'Tema Motorway', specialty: 'Car Wash', icon: <FillingStationIcon size={12} color="var(--forest)" /> },
      ],
      shop: [
        { area: 'Abossey Okai, Accra', specialty: 'Brake Pads', icon: <Wrench size={12} weight="bold" /> },
        { area: 'Sodom & Gomorrah', specialty: 'Engine Oil', icon: <Wrench size={12} weight="bold" /> },
        { area: 'Circle, Accra', specialty: 'Spark Plugs', icon: <Wrench size={12} weight="bold" /> },
      ],
    };
    const key = viewMode === 'detailers' ? 'detailers' : viewMode === 'fuel' ? 'fuel' : viewMode === 'shop' ? 'shop' : 'all';
    return sets[key];
  }, [viewMode]);
  const isBookmarksEmpty = (viewMode === 'saved' || viewMode === 'history') && sortedMechanics.length === 0;
  const { filledCount } = useBentoRevealLoop(isBookmarksEmpty);
  const [carouselSlide, setCarouselSlide] = useState(0);
  const [carouselAnimate, setCarouselAnimate] = useState(true);
  const trackRef = useRef(null);

  useEffect(() => {
    if (!isBookmarksEmpty) {
      setCarouselSlide(0);
      setCarouselAnimate(true);
      return;
    }
    const totalSlides = 6;
    const interval = setInterval(() => {
      setCarouselSlide(prev => {
        const next = prev + 1;
        if (next >= totalSlides) {
          // Jump back to start — disable animation for seamless reset
          setCarouselAnimate(false);
          return 0;
        }
        setCarouselAnimate(true);
        return next;
      });
    }, 5200);
    return () => clearInterval(interval);
  }, [isBookmarksEmpty]);

  // Re-enable transition after a reset jump settles
  useEffect(() => {
    if (carouselSlide === 0 && !carouselAnimate) {
      const timer = requestAnimationFrame(() => {
        setCarouselAnimate(true);
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [carouselSlide, carouselAnimate]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target) &&
          filterPopupRef.current && !filterPopupRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
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
  if (sheetState === 'expanded') transformBase = '240px';

  const isFullPage = isMobile && (viewMode === 'saved' || viewMode === 'history');
  const dynamicStyle = isMobile && !isFullPage ? {
    transform: `translateY(calc(${transformBase} + ${dragOffset}px))`
  } : {};

  const verificationPortal = useMemo(() => {
    if (!verificationSheet) return null;
    return createPortal(
      <VerificationSheet tier={verificationSheet.tier} name={verificationSheet.name} onClose={() => setVerificationSheet(null)} />,
      document.body
    );
  }, [verificationSheet]);

  const directionPeekTarget = directionPeek ? mechanics.find(m => m.id === directionTargetId) : null;
  if (directionPeekTarget) {
    return (
      <>
        <div className="mechanic-detail-collapsed">
          <div className="detail-collapsed-info" onClick={() => setDirectionPeek(false)}>
            <h2 className="detail-collapsed-name">{directionPeekTarget.name}</h2>
            <p className="detail-collapsed-area">{directionPeekTarget.area}{directionPeekTarget.distance ? ` · ${directionPeekTarget.distance}` : ''}</p>
          </div>
          <div className="detail-collapsed-actions">
            {directionPeekTarget.phone && (
              <button
                className="detail-collapsed-call"
                aria-label="Call"
                onClick={() => { window.location.href = `tel:${directionPeekTarget.phone.replace(/\s+/g, '')}`; }}
              >
                <CallIcon size={16} />
              </button>
            )}
            <button
              className="detail-collapsed-close"
              aria-label="Close"
              onClick={() => { setDirectionTargetId(null); onDirection(null); setDirectionPeek(false); }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {verificationPortal}
      </>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`mechanic-list-panel ${isDragging ? 'dragging' : ''} ${hideOnDesktop ? 'mechanic-list-panel--hidden-desktop' : ''} ${isFullPage ? 'mechanic-list-panel--fullpage' : ''}`}
      style={dynamicStyle}
    >
      {isFullPage && (
        <div className="fullpage-header">
          <button className="fullpage-back-btn" onClick={onOpenSidebar} aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <h1 className="fullpage-title">{viewMode === 'saved' ? 'Bookmarks' : 'History'}</h1>
          <div className="fullpage-spacer" />
        </div>
      )}
      {!isFullPage && (
        <div
          className="list-drag-strip"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="mobile-drag-handle"></div>
        </div>
      )}

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
              /* Title + tabs pin to the top together while the cards below scroll.
                 (Title is skipped in full-page mode — fullpage-header already shows it.) */
              <div className="list-sticky-header">
                {!isFullPage && <h1 className="list-title">{viewMode === 'saved' ? 'Bookmarks' : 'History'}</h1>}
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
                      placeholder=""
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onPointerDown={(e) => {
                        if (isMobile && onOpenSearch) {
                          // Hand off to the full-screen search overlay instead of
                          // expanding the sheet in place.
                          e.preventDefault();
                          onOpenSearch();
                          return;
                        }
                        if (isMobile && sheetState !== 'expanded') {
                          if (panelRef.current) {
                            panelRef.current.style.transition = 'none';
                            panelRef.current.style.transform = 'translateY(240px)';
                          }
                          setSheetState('expanded');
                          setDragOffset(0);
                        }
                      }}
                      onFocus={() => {
                        if (searchTerm) setShowSuggestions(true);
                        if (isMobile && panelRef.current) panelRef.current.style.transition = '';
                      }}
                    />
                    {!searchTerm && (
                      <span className="search-placeholder-animated">
                        <span className="search-placeholder-prefix">Search </span>
                        <span className="search-placeholder-suffix">{placeholderText}<span className="placeholder-cursor">|</span></span>
                      </span>
                    )}
                    {searchTerm && (
                    
                        <svg 
                      aria-label="Clear search"
                          onClick={() => {
                            setSearchTerm('');
                            setShowSuggestions(false);
                            onSearch('');
                          }}
                        xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M5.33464 15.8334L4.16797 14.6667L8.83464 10.0001L4.16797 5.33341L5.33464 4.16675L10.0013 8.83341L14.668 4.16675L15.8346 5.33341L11.168 10.0001L15.8346 14.6667L14.668 15.8334L10.0013 11.1667L5.33464 15.8334Z" fill="black" fill-opacity="0.6" />
                        </svg>
               
                    )}
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
                    <button type="button" className={`filter-btn ${activeFilterCount > 0 ? 'filter-btn--active' : ''}`} onClick={() => setIsFilterOpen(!isFilterOpen)}>
                      <FilterIcon size={18} />
                      {activeFilterCount > 0 && <span className="filter-btn-badge">{activeFilterCount}</span>}
                    </button>
                    {isFilterOpen && (() => {
                      const filterPopup = (
                        <div className="filter-popup" ref={filterPopupRef}>
                          <div className="mobile-drag-handle"></div>
                          <div className="filter-header">
                            <h2>Filters</h2>
                            <button
                              type="button"
                              className="clear-all-btn"
                              onClick={() => setSelectedFilters({ services: [], availability: [], distance: null, rating: null })}
                            >
                              Clear all
                            </button>
                          </div>
                          <div className="filter-tabs">
                            <div className={`filter-tab ${activeFilterTab === 'Services' ? 'active' : ''}`} onClick={() => setActiveFilterTab('Services')}>
                              Services {selectedFilters.services.length > 0 && <span className="tab-badge">{selectedFilters.services.length}</span>}
                            </div>
                            <div className={`filter-tab ${activeFilterTab === 'Availability' ? 'active' : ''}`} onClick={() => setActiveFilterTab('Availability')}>Availability</div>
                            <div className={`filter-tab ${activeFilterTab === 'Distance' ? 'active' : ''}`} onClick={() => setActiveFilterTab('Distance')}>
                              Distance {selectedFilters.distance && <span className="tab-badge">1</span>}
                            </div>
                            <div className={`filter-tab ${activeFilterTab === 'Rating' ? 'active' : ''}`} onClick={() => setActiveFilterTab('Rating')}>
                              Rating {selectedFilters.rating && <span className="tab-badge">1</span>}
                            </div>
                          </div>

                          {activeFilterTab === 'Services' && (
                            <div className="filter-body">
                              {['General Repair', 'Brakes', 'Electric Fault', 'Lights', 'Engine', 'Spraying', 'Upgrade', 'Diagnostics'].map(s => {
                                const active = selectedFilters.services.includes(s);
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    className={`filter-pill ${active ? 'active' : ''}`}
                                    onClick={() => setSelectedFilters(prev => ({
                                      ...prev,
                                      services: active ? prev.services.filter(x => x !== s) : [...prev.services, s],
                                    }))}
                                  >
                                    {s}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {activeFilterTab === 'Availability' && (
                            <div className="filter-body">
                              {['Open Now', '24/7', 'Week Days', 'Weekends'].map(a => {
                                const active = selectedFilters.availability.includes(a);
                                return (
                                  <button
                                    key={a}
                                    type="button"
                                    className={`filter-pill ${active ? 'active' : ''}`}
                                    onClick={() => setSelectedFilters(prev => ({
                                      ...prev,
                                      availability: active ? prev.availability.filter(x => x !== a) : [...prev.availability, a],
                                    }))}
                                  >
                                    {a}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {activeFilterTab === 'Distance' && (
                            <div className="filter-body">
                              {[
                                { label: '1 km', key: '1 km' },
                                { label: '3 km', key: '3 km' },
                                { label: '5 km', key: '5 km' },
                                { label: '10 km+', key: '10 km+' },
                              ].map(d => {
                                const active = selectedFilters.distance === d.key;
                                return (
                                  <button
                                    key={d.key}
                                    type="button"
                                    className={`filter-pill alt ${active ? 'active' : ''}`}
                                    onClick={() => setSelectedFilters(prev => ({
                                      ...prev,
                                      distance: active ? null : d.key,
                                    }))}
                                  >
                                    {d.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {activeFilterTab === 'Rating' && (
                            <div className="filter-body">
                              {[
                                { label: 'Any', key: null },
                                { label: '4.0+', key: '4.0+' },
                                { label: '4.5+', key: '4.5+' },
                              ].map(r => {
                                const active = selectedFilters.rating === r.key;
                                return (
                                  <button
                                    key={r.label}
                                    type="button"
                                    className={`filter-pill alt ${active ? 'active' : ''}`}
                                    onClick={() => setSelectedFilters(prev => ({
                                      ...prev,
                                      rating: active ? null : r.key,
                                    }))}
                                  >
                                    {r.label}
                                  </button>
                                );
                              })}
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
                <span className="count">
                  {searchedArea ? (
                    <><strong>{sortedMechanics.length}</strong> search results for &ldquo;<strong>{searchedArea}</strong>&rdquo;</>
                  ) : (
                    <>{sortedMechanics.length} {viewMode === 'detailers' ? 'Detailers' : viewMode === 'fuel' ? 'Fuel Stations' : viewMode === 'shop' ? 'Auto Parts Dealers' : 'Mechanics'} · {viewMode === 'saved' ? 'Bookmarks' : 'Near You'}</>
                  )}
                </span>
                {!searchedArea && (
                <div className="sort-container" ref={sortRef}>
                  <span className="sort" onClick={() => setIsSortOpen(!isSortOpen)}>
                    {currentSort} ↓
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
                )}
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
                    <FillingStationIcon size={24} state="filled" color="var(--forest)" />
                  ) : (
                    <LocationIcon size={24} state="filled" color="var(--forest)" />
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
                <div key={i} className="popular-product-card" onClick={() => {
                  setProductSheet({
                    item: { ...p, type: 'product', name: p.name, price: p.price, imageUrl: p.imageUrl },
                    mechanicName: p.mechanicName,
                    mechanicId: p.mechanicId,
                    mechanicPhone: mechanics.find(m => m.id === p.mechanicId)?.phone,
                  });
                }}>
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
          {(viewMode === 'saved' || viewMode === 'history') && sortedMechanics.length === 0 ? (
            <div className="bookmarks-empty">
              <div className="bookmarks-empty-cards">
                <div
                  ref={trackRef}
                  className="bookmarks-empty-cards-track"
                  style={{
                    transform: `translateX(-${carouselSlide * (292 + 16)}px)`,
                    transition: carouselAnimate ? 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                  }}
                >
                  {[0, 1, 2, 0, 1, 2].map((cardIdx, i) => {
                    const filled = cardIdx < filledCount;
                    const data = carouselCardData[cardIdx];
                    return (
                      <div
                        key={`${i}-${cardIdx}`}
                        className={[
                          'bookmarks-empty-card',
                          i % 3 !== 1 ? 'bookmarks-empty-card--dim' : '',
                        ].filter(Boolean).join(' ')}
                      >
                      <div className="skeleton-card-body">
                        <div className="skeleton-card-top">
                          <div className="skeleton-avatar"></div>
                          <div className="skeleton-badges">
                            <div className="skeleton-badge"></div>
                            <div className="skeleton-badge"></div>
                            <span className="bookmarks-empty-open-pill">Open</span>
                          </div>
                        </div>
                        <div className="skeleton-name"></div>
                        <div className="bookmarks-empty-area">{data.area}</div>
                        <div className="bookmarks-empty-specialty">
                          {data.icon}
                          {data.specialty}
                        </div>
                      </div>
                      <div className="skeleton-card-bar">
                        <div className="skeleton-bar-left">
                          <div className={`bookmarks-empty-bookmark-btn ${filled ? 'bookmarks-empty-bookmark-btn--active' : ''}`}>
                            <BookmarkIcon size={16} state={filled ? 'filled' : 'default'} color={filled ? '#145E42' : 'currentColor'} />
                          </div>
                          <div className="skeleton-bar-btn"><RateIcon size={16} /></div>
                          <div className="skeleton-bar-btn"><ShareIcon size={16} /></div>
                          <div className="bookmarks-empty-bar-divider" />
                        </div>
                        <div className="bookmarks-empty-call-btn">
                          <CallIcon size={16} />
                          Call
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
              <p className="bookmarks-empty-text">
                {viewMode === 'saved'
                  ? 'Save mechanics, detailers, shops, or fuel stations you want to find again quickly.'
                  : 'Your calls, directions and interactions will appear here.'}
              </p>
              <button className="bookmarks-empty-btn" onClick={onNavigateHome}>
                Discover Mechanics
              </button>
            </div>
          ) : (
            sortedMechanics.map((m, idx) => {
              const tier = getVerificationTier(m);
              const prevTier = idx > 0 ? getVerificationTier(sortedMechanics[idx - 1]) : 0;
              const showDivider = tier === 3 && prevTier <= 2;
              const tierIcon = tier === 1 ? <VerifiedIcon size={14} /> : tier === 2 ? <ClaimedIcon size={14} /> : null;
              const featuredProducts = (m.products || []).slice(0, 3);
              const showFeatured = viewMode === 'shop' && featuredProducts.length > 0;
              const recentInteraction = getRecentInteraction(recentInteractions || {}, m.id);
              const searchMatch = searchedArea ? findProductServiceMatch(m, searchedArea) : null;

              return (
                <React.Fragment key={m.id}>
                  {showDivider && (
                    <div className="verification-divider" onClick={() => setVerificationSheet({ tier: 3 })}>
                      <div className="verification-divider-line"></div>
                      <span className="verification-divider-label">Unverified</span>
                      <UnverifiedIcon size={14} color="var(--forest)" />
                      <div className="verification-divider-line"></div>
                    </div>
                  )}
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
                            <h3 className="card-name">
                              {m.name}
                              {tierIcon && <span className="card-verify-icon" onClick={(e) => { e.stopPropagation(); setVerificationSheet({ tier, name: m.name }); }}>{tierIcon}</span>}
                            </h3>
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
                            onClick={(e) => { e.stopPropagation(); const nextId = directionTargetId === m.id ? null : m.id; setDirectionTargetId(nextId); onDirection(nextId ? m : null); setDirectionPeek(isMobile && !!nextId); }}
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
                            <h3 className="card-name">
                              {m.name}
                              {tierIcon && <span className="card-verify-icon" onClick={(e) => { e.stopPropagation(); setVerificationSheet({ tier, name: m.name }); }}>{tierIcon}</span>}
                            </h3>
                            <p className="card-area">{m.area}</p>
                          </div>

                          {!showFeatured && viewMode !== 'detailers' && (
                            <div className="card-specialty-row">
                              {searchMatch ? (
                                <div className="card-search-match">
                                  <SearchIcon size={14} />
                                  <span className="card-search-match-label">{searchMatch.label}</span>
                                </div>
                              ) : (m.specialties?.length || m.specialty) ? (
                                <div className="card-specialty">
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="0.75" />
                                    <circle cx="7" cy="7" r="2" fill="currentColor" opacity="0.2" />
                                  </svg>
                                  <SpecialtyTypewriter specialties={(m.specialties?.length ? m.specialties : [m.specialty])} />
                                </div>
                              ) : null}
                              {recentInteraction && (
                                <InteractionBadge action={recentInteraction.action} timestamp={recentInteraction.timestamp} />
                              )}
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
                            onClick={(e) => { e.stopPropagation(); const nextId = directionTargetId === m.id ? null : m.id; setDirectionTargetId(nextId); onDirection(nextId ? m : null); setDirectionPeek(isMobile && !!nextId); if (nextId) onRecordInteraction?.(m.id, 'direction'); }}
                          >
                            <LocationIcon size={16} />
                            <span className="card-action-label">Direction</span>
                          </button>
                          <button
                            className="card-bottom-action"
                            onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${m.phone.replace(/\s+/g, '')}`; onRecordInteraction?.(m.id, 'call'); }}
                          >
                            <CallIcon size={16} />
                            <span>Call</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
      {verificationPortal}

      {/* Portaled to document.body — .mechanic-list-panel has a persistent
          inline transform (for its swipe-to-drag sheet), and any ancestor
          transform becomes the containing block for this sheet's own
          position:fixed overlay, which broke its full-viewport positioning. */}
      {productSheet && createPortal(
        <ItemSheet
          item={productSheet.item}
          mechanicName={productSheet.mechanicName}
          mechanicPhone={productSheet.mechanicPhone}
          onClose={() => setProductSheet(null)}
          onSelectShop={() => {
            const m = mechanics.find(m => m.id === productSheet.mechanicId);
            if (m) onSelect(m);
          }}
        />,
        document.body
      )}
    </div>
  );
}

function VerificationSheet({ tier, name, onClose }) {
  const config = {
    1: { title: 'Verified By Gears', desc: "Our team personally confirmed this business — we called or visited them, checked their contact details, and verified they're actively operating." },
    2: { title: 'Profile Claimed', desc: "This business claimed and set up their own profile on Gears. We haven't independently confirmed every detail yet, but the owner is actively managing this listing." },
    3: { title: 'Not Yet Verified', desc: "This listing was found on public map data and hasn't been confirmed by Gears or claimed by the business yet." },
  };
  const { title, desc } = config[tier] || config[3];

  return (
    <div className="verification-sheet-overlay" onClick={onClose}>
      <div className="verification-sheet" onClick={e => e.stopPropagation()}>
        <div className="verification-sheet-icon">
          {tier === 1 ? <VerifiedIcon size={44} /> : tier === 2 ? <ClaimedIcon size={44} /> : <UnverifiedIcon size={44} />}
        </div>
        <h3 className="verification-sheet-title">{title}</h3>
        <p className="verification-sheet-desc">{desc}</p>
        <div className="verification-sheet-footer">
          <button className="verification-sheet-btn" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}
