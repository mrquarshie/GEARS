import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query } from 'firebase/firestore';
import { LocationPicker, TILE_URL, TILE_SUBDOMAINS, TILE_ATTRIBUTION } from './MapLayout';
import {
  List,
  ArrowsLeftRight,
  ImageSquare,
  Plus,
  Trash,
  ToggleLeft,
  ToggleRight,
  X,
  Eye,
  Phone,
  MagnifyingGlass,
  BookmarkSimple,
  ListPlus,
  Gear,
  QrCode,
  Wrench,
  Check,
  CaretDown,
  CaretLeft,
  ClockCounterClockwise,
  Bell,
  SquaresFour,
} from '@phosphor-icons/react';
import { FillingStationIcon, CarDetailingIcon, ShopIcon } from './icons';
import { db } from '../firebase';
import bizIllustrationBattery from './AuthImages/Car battery.png';
import bizIllustrationEngine from './AuthImages/Engine.png';
import bizIllustrationSteer from './AuthImages/Steer.png';

function BizAvatar({ user, onClick }) {
  const initial = user?.displayName?.trim()?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
  const content = user?.photoURL
    ? <img src={user.photoURL} alt="" className="biz-avatar" referrerPolicy="no-referrer" />
    : <div className="biz-avatar biz-avatar-letter">{initial}</div>;
  if (!onClick) return content;
  return <button type="button" className="biz-avatar-btn" onClick={onClick} aria-label="Account">{content}</button>;
}

// Same square-with-initial treatment used for mechanic cards elsewhere
// (.card-avatar), reused here so a business reads the same way in its own
// switcher as it does in the customer-facing list.
function BizAccountAvatar({ name }) {
  return <div className="card-avatar biz-account-avatar">{name?.charAt(0)?.toUpperCase() || '?'}</div>;
}

// Businesses aren't tagged with a `businessType` enum on save — the rest of
// the app (search suggestions, list icons) already keys off the `specialty`
// string instead, so this mirrors that instead of inventing a new field.
function businessTypeLabel(specialty) {
  if (specialty === 'Fuel Station') return 'Fuel Station';
  if (specialty === 'Car Detailing') return 'Detailer';
  if (specialty === 'Auto Parts') return 'Auto Shop';
  return 'Mechanic';
}

function BizAccountTypeIcon({ specialty }) {
  if (specialty === 'Fuel Station') return <FillingStationIcon size={14} />;
  if (specialty === 'Car Detailing') return <CarDetailingIcon size={14} />;
  if (specialty === 'Auto Parts') return <ShopIcon size={14} />;
  return <Wrench size={14} />;
}

// Catalog empty-state illustration — 3 cards that rotate through 3 fixed
// slots every 5s (each item keeps its own color/name as it moves, rather
// than the slot owning the color, so it reads as "3 real items shuffling"
// instead of a card's background just cycling independently of its content).
const CATALOG_EMPTY_ITEMS = [
  { name: 'Engine', image: bizIllustrationEngine, bg: '#e6ffee' },
  { name: 'Car Battery', image: bizIllustrationBattery, bg: '#fdedff' },
  { name: 'Steer', image: bizIllustrationSteer, bg: '#ffeecc' },
];

// [left, right, center] slot geometry in px, sized for the stack's 340px
// max-width / 148px card width (matches the design's original layout).
const CATALOG_EMPTY_SLOTS = [
  { left: 0, top: 28, rotate: -11, z: 1 },
  { left: 96, top: 4, rotate: 0, z: 2 },
  { left: 192, top: 28, rotate: 12, z: 1 },
];
// relative distance from the featured (center) item -> which slot it sits in
const CATALOG_EMPTY_SLOT_FOR_RELATIVE = [1, 0, 2];

// Types `text` out one character at a time instead of swapping it in
// instantly — used for the empty-state caption as it cycles product names.
function useTypewriter(text, speed = 45) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    let i = 0;
    setTyped('');
    const id = setInterval(() => {
      i += 1;
      setTyped(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return typed;
}

// Plays a short, mechanical "clack" (gear/ratchet-like) via the Web Audio API.
function playTapSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // Low mechanical thump — square wave, quick pitch drop.
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(220, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    gain1.gain.setValueAtTime(0.09, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.1);

    // Metallic "ping" — high sawtooth with a fast decay.
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(1400, now);
    osc2.frequency.exponentialRampToValueAtTime(500, now + 0.04);
    gain2.gain.setValueAtTime(0.025, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.01);
    osc2.stop(now + 0.06);
  } catch {
    // Audio unavailable — ignore.
  }
}

function BizHomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.3661 6.25171L13.0861 2.55754C11.647 1.54921 9.43781 1.60421 8.05365 2.67671L3.46115 6.26088C2.54448 6.97588 1.82031 8.44254 1.82031 9.59754V15.9225C1.82031 18.26 3.71781 20.1667 6.05531 20.1667H15.937C18.2745 20.1667 20.172 18.2692 20.172 15.9317V9.71671C20.172 8.47921 19.3745 6.95754 18.3661 6.25171ZM11.6836 16.5C11.6836 16.8759 11.372 17.1875 10.9961 17.1875C10.6203 17.1875 10.3086 16.8759 10.3086 16.5V13.75C10.3086 13.3742 10.6203 13.0625 10.9961 13.0625C11.372 13.0625 11.6836 13.3742 11.6836 13.75V16.5Z" fill="currentColor" />
    </svg>
  );
}

function BizCatalogIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.2" d="M17.6688 13.6993L18.3623 16.5L15.8125 14.9995L13.2627 16.5L13.9562 13.6993L11.6875 11.8259L14.6652 11.5964L15.8125 8.9375L16.9598 11.5964L19.9375 11.8259L17.6688 13.6993Z" fill="currentColor" />
      <path d="M2.75 5.5C2.75 5.31766 2.82243 5.1428 2.95136 5.01386C3.0803 4.88493 3.25516 4.8125 3.4375 4.8125H18.5625C18.7448 4.8125 18.9197 4.88493 19.0486 5.01386C19.1776 5.1428 19.25 5.31766 19.25 5.5C19.25 5.68234 19.1776 5.8572 19.0486 5.98614C18.9197 6.11507 18.7448 6.1875 18.5625 6.1875H3.4375C3.25516 6.1875 3.0803 6.11507 2.95136 5.98614C2.82243 5.8572 2.75 5.68234 2.75 5.5ZM3.4375 11.6875H8.25C8.43234 11.6875 8.6072 11.6151 8.73614 11.4861C8.86507 11.3572 8.9375 11.1823 8.9375 11C8.9375 10.8177 8.86507 10.6428 8.73614 10.5139C8.6072 10.3849 8.43234 10.3125 8.25 10.3125H3.4375C3.25516 10.3125 3.0803 10.3849 2.95136 10.5139C2.82243 10.6428 2.75 10.8177 2.75 11C2.75 11.1823 2.82243 11.3572 2.95136 11.4861C3.0803 11.6151 3.25516 11.6875 3.4375 11.6875ZM9.625 15.8125H3.4375C3.25516 15.8125 3.0803 15.8849 2.95136 16.0139C2.82243 16.1428 2.75 16.3177 2.75 16.5C2.75 16.6823 2.82243 16.8572 2.95136 16.9861C3.0803 17.1151 3.25516 17.1875 3.4375 17.1875H9.625C9.80734 17.1875 9.9822 17.1151 10.1111 16.9861C10.2401 16.8572 10.3125 16.6823 10.3125 16.5C10.3125 16.3177 10.2401 16.1428 10.1111 16.0139C9.9822 15.8849 9.80734 15.8125 9.625 15.8125ZM20.3749 12.3561L18.4396 13.9537L19.0291 16.335C19.0615 16.4663 19.0543 16.6042 19.0087 16.7315C18.963 16.8588 18.8808 16.9697 18.7724 17.0505C18.664 17.1313 18.5342 17.1784 18.3992 17.1858C18.2641 17.1932 18.1299 17.1606 18.0134 17.0921L15.8125 15.797L13.6116 17.0921C13.4951 17.1606 13.3609 17.1932 13.2258 17.1858C13.0908 17.1784 12.961 17.1313 12.8526 17.0505C12.7442 16.9697 12.662 16.8588 12.6163 16.7315C12.5707 16.6042 12.5635 16.4663 12.5959 16.335L13.1845 13.9537L11.2501 12.3561C11.1446 12.2688 11.0675 12.1521 11.0288 12.0208C10.9901 11.8895 10.9915 11.7496 11.0327 11.6191C11.074 11.4886 11.1533 11.3733 11.2604 11.2881C11.3676 11.2029 11.4977 11.1517 11.6342 11.1409L14.1986 10.9424L15.1809 8.66508C15.2339 8.54157 15.3221 8.43633 15.4343 8.36239C15.5466 8.28844 15.6781 8.24903 15.8125 8.24903C15.9469 8.24903 16.0784 8.28844 16.1907 8.36239C16.3029 8.43633 16.3911 8.54157 16.4441 8.66508L17.4264 10.9424L19.9908 11.1409C20.1273 11.1517 20.2574 11.2029 20.3646 11.2881C20.4717 11.3733 20.551 11.4886 20.5923 11.6191C20.6335 11.7496 20.6349 11.8895 20.5962 12.0208C20.5575 12.1521 20.4804 12.2688 20.3749 12.3561ZM18.1861 12.3802L16.9065 12.2813C16.7817 12.2717 16.6618 12.2283 16.5599 12.1556C16.458 12.0829 16.3778 11.9837 16.3281 11.8688L15.8125 10.6726L15.2969 11.8688C15.2472 11.9837 15.167 12.0829 15.0651 12.1556C14.9632 12.2283 14.8433 12.2717 14.7185 12.2813L13.4389 12.3802L14.3937 13.1691C14.4937 13.2515 14.5684 13.3605 14.6091 13.4835C14.6499 13.6065 14.655 13.7385 14.624 13.8643L14.3232 15.0777L15.4636 14.4066C15.5693 14.3443 15.6898 14.3114 15.8125 14.3114C15.9352 14.3114 16.0557 14.3443 16.1614 14.4066L17.3018 15.0777L17.001 13.8643C16.97 13.7385 16.9751 13.6065 17.0159 13.4835C17.0566 13.3605 17.1313 13.2515 17.2313 13.1691L18.1861 12.3802Z" fill="currentColor" fillOpacity="0.5" />
    </svg>
  );
}

function BizMapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.2" d="M11 2.0625C9.17664 2.0625 7.42795 2.78683 6.13864 4.07614C4.84933 5.36545 4.125 7.11414 4.125 8.9375C4.125 15.125 11 19.9375 11 19.9375C11 19.9375 17.875 15.125 17.875 8.9375C17.875 7.11414 17.1507 5.36545 15.8614 4.07614C14.572 2.78683 12.8234 2.0625 11 2.0625ZM11 11.6875C10.4561 11.6875 9.92442 11.5262 9.47218 11.224C9.01995 10.9219 8.66747 10.4924 8.45933 9.98988C8.25119 9.48738 8.19673 8.93445 8.30284 8.401C8.40895 7.86755 8.67086 7.37755 9.05546 6.99296C9.44005 6.60836 9.93005 6.34645 10.4635 6.24034C10.9969 6.13423 11.5499 6.18869 12.0524 6.39683C12.5549 6.60497 12.9844 6.95745 13.2865 7.40968C13.5887 7.86192 13.75 8.3936 13.75 8.9375C13.75 9.66685 13.4603 10.3663 12.9445 10.882C12.4288 11.3978 11.7293 11.6875 11 11.6875Z" fill="currentColor" />
      <path d="M17.1875 19.25H12.937C13.651 18.6125 14.3244 17.9308 14.9531 17.209C17.3121 14.4959 18.5625 11.6359 18.5625 8.9375C18.5625 6.9318 17.7657 5.00825 16.3475 3.59001C14.9293 2.17176 13.0057 1.375 11 1.375C8.9943 1.375 7.07075 2.17176 5.65251 3.59001C4.23426 5.00825 3.4375 6.9318 3.4375 8.9375C3.4375 11.6359 4.68445 14.4959 7.04688 17.209C7.6756 17.9308 8.34895 18.6125 9.06297 19.25H4.8125C4.63016 19.25 4.4553 19.3224 4.32636 19.4514C4.19743 19.5803 4.125 19.7552 4.125 19.9375C4.125 20.1198 4.19743 20.2947 4.32636 20.4236C4.4553 20.5526 4.63016 20.625 4.8125 20.625H17.1875C17.3698 20.625 17.5447 20.5526 17.6736 20.4236C17.8026 20.2947 17.875 20.1198 17.875 19.9375C17.875 19.7552 17.8026 19.5803 17.6736 19.4514C17.5447 19.3224 17.3698 19.25 17.1875 19.25ZM4.8125 8.9375C4.8125 7.29647 5.4644 5.72266 6.62478 4.56228C7.78516 3.4019 9.35897 2.75 11 2.75C12.641 2.75 14.2148 3.4019 15.3752 4.56228C16.5356 5.72266 17.1875 7.29647 17.1875 8.9375C17.1875 13.8557 12.4205 17.9609 11 19.0781C9.57945 17.9609 4.8125 13.8557 4.8125 8.9375ZM14.4375 8.9375C14.4375 8.25763 14.2359 7.59302 13.8582 7.02773C13.4805 6.46243 12.9436 6.02184 12.3155 5.76166C11.6874 5.50149 10.9962 5.43341 10.3294 5.56605C9.66257 5.69869 9.05006 6.02608 8.56932 6.50682C8.08858 6.98756 7.76119 7.60007 7.62855 8.26688C7.49591 8.93369 7.56399 9.62485 7.82416 10.253C8.08434 10.8811 8.52493 11.418 9.09023 11.7957C9.65552 12.1734 10.3201 12.375 11 12.375C11.9117 12.375 12.786 12.0128 13.4307 11.3682C14.0753 10.7235 14.4375 9.84918 14.4375 8.9375ZM8.9375 8.9375C8.9375 8.52958 9.05846 8.13081 9.28509 7.79164C9.51172 7.45246 9.83384 7.1881 10.2107 7.032C10.5876 6.87589 11.0023 6.83505 11.4024 6.91463C11.8025 6.99421 12.17 7.19065 12.4584 7.47909C12.7469 7.76754 12.9433 8.13504 13.0229 8.53513C13.1025 8.93521 13.0616 9.34991 12.9055 9.72678C12.7494 10.1037 12.485 10.4258 12.1459 10.6524C11.8067 10.879 11.4079 11 11 11C10.453 11 9.92839 10.7827 9.54159 10.3959C9.1548 10.0091 8.9375 9.48451 8.9375 8.9375Z" fill="currentColor" fillOpacity="0.5" />
    </svg>
  );
}

function BizMediaIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.2" d="M17.875 3.4375H6.875C6.69266 3.4375 6.5178 3.50993 6.38886 3.63886C6.25993 3.7678 6.1875 3.94266 6.1875 4.125V15.125C6.1875 15.3073 6.25993 15.4822 6.38886 15.6111C6.5178 15.7401 6.69266 15.8125 6.875 15.8125H8.3093L14.9823 9.13859C15.0462 9.07467 15.122 9.02396 15.2055 8.98937C15.2889 8.95477 15.3784 8.93696 15.4688 8.93696C15.5591 8.93696 15.6486 8.95477 15.732 8.98937C15.8155 9.02396 15.8913 9.07467 15.9552 9.13859L18.5625 11.7468V4.125C18.5625 3.94266 18.4901 3.7678 18.3611 3.63886C18.2322 3.50993 18.0573 3.4375 17.875 3.4375ZM10.3125 8.9375C10.0406 8.9375 9.77471 8.85686 9.54859 8.70577C9.32247 8.55468 9.14624 8.33994 9.04217 8.08869C8.9381 7.83744 8.91087 7.56097 8.96392 7.29425C9.01697 7.02753 9.14793 6.78253 9.34023 6.59023C9.53253 6.39793 9.77753 6.26697 10.0443 6.21392C10.311 6.16087 10.5874 6.1881 10.8387 6.29217C11.0899 6.39624 11.3047 6.57247 11.4558 6.79859C11.6069 7.02471 11.6875 7.29055 11.6875 7.5625C11.6875 7.92717 11.5426 8.27691 11.2848 8.53477C11.0269 8.79263 10.6772 8.9375 10.3125 8.9375Z" fill="currentColor" />
      <path d="M17.875 2.75H6.875C6.51033 2.75 6.16059 2.89487 5.90273 3.15273C5.64487 3.41059 5.5 3.76033 5.5 4.125V5.5H4.125C3.76033 5.5 3.41059 5.64487 3.15273 5.90273C2.89487 6.16059 2.75 6.51033 2.75 6.875V17.875C2.75 18.2397 2.89487 18.5894 3.15273 18.8473C3.41059 19.1051 3.76033 19.25 4.125 19.25H15.125C15.4897 19.25 15.8394 19.1051 16.0973 18.8473C16.3551 18.5894 16.5 18.2397 16.5 17.875V16.5H17.875C18.2397 16.5 18.5894 16.3551 18.8473 16.0973C19.1051 15.8394 19.25 15.4897 19.25 15.125V4.125C19.25 3.76033 19.1051 3.41059 18.8473 3.15273C18.5894 2.89487 18.2397 2.75 17.875 2.75ZM6.875 4.125H17.875V10.0873L16.4398 8.65219C16.182 8.39452 15.8324 8.24978 15.4679 8.24978C15.1034 8.24978 14.7538 8.39452 14.4959 8.65219L8.02398 15.125H6.875V4.125ZM15.125 17.875H4.125V6.875H5.5V15.125C5.5 15.4897 5.64487 15.8394 5.90273 16.0973C6.16059 16.3551 6.51033 16.5 6.875 16.5H15.125V17.875ZM17.875 15.125H9.96875L15.4688 9.625L17.875 12.0312V15.125ZM10.3125 9.625C10.7204 9.625 11.1192 9.50404 11.4584 9.27741C11.7975 9.05078 12.0619 8.72866 12.218 8.35178C12.3741 7.97491 12.415 7.56021 12.3354 7.16013C12.2558 6.76004 12.0594 6.39254 11.7709 6.10409C11.4825 5.81565 11.115 5.61921 10.7149 5.53963C10.3148 5.46005 9.90009 5.50089 9.52322 5.657C9.14634 5.8131 8.82422 6.07746 8.59759 6.41664C8.37096 6.75581 8.25 7.15458 8.25 7.5625C8.25 8.10951 8.4673 8.63411 8.85409 9.02091C9.24089 9.4077 9.76549 9.625 10.3125 9.625ZM10.3125 6.875C10.4485 6.875 10.5814 6.91532 10.6945 6.99086C10.8075 7.06641 10.8956 7.17378 10.9477 7.2994C10.9997 7.42503 11.0133 7.56326 10.9868 7.69662C10.9603 7.82999 10.8948 7.95249 10.7986 8.04864C10.7025 8.14478 10.58 8.21026 10.4466 8.23679C10.3133 8.26332 10.175 8.2497 10.0494 8.19767C9.92378 8.14563 9.81641 8.05751 9.74086 7.94445C9.66532 7.8314 9.625 7.69847 9.625 7.5625C9.625 7.38016 9.69743 7.2053 9.82636 7.07636C9.9553 6.94743 10.1302 6.875 10.3125 6.875Z" fill="currentColor" fillOpacity="0.5" />
    </svg>
  );
}

// Shared by the mobile bottom tab bar and the desktop sidebar nav — same
// four destinations, same click handling, just laid out differently per
// breakpoint (row of pill buttons vs. a vertical list).
const TAB_ITEMS = [
  { key: 'home', label: 'Home', Icon: BizHomeIcon },
  { key: 'catalog', label: 'Catalog', Icon: BizCatalogIcon },
  { key: 'map', label: 'Map', Icon: BizMapIcon },
  { key: 'media', label: 'Media', Icon: BizMediaIcon },
];

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function BusinessDashboard({ user, mechanic, businesses, onSwitchBusiness, onUpdateLocation, onExit, show }) {
  const [activeTab, setActiveTab] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [pendingAdd, setPendingAdd] = useState(null); // 'product' | 'service' | 'media'

  const handleAddOption = (kind) => {
    setShowAddSheet(false);
    setPendingAdd(kind);
    setActiveTab(kind === 'media' ? 'media' : 'catalog');
  };

  const PAGE_TITLES = { home: 'Overview', catalog: 'Catalog', map: 'Map', media: 'Media' };

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <div className="biz-dashboard">
      {/* Desktop-only: mobile uses the hamburger + bottom tab bar below instead. */}
      <aside className="biz-sidebar">
        <div className="biz-sidebar-brand">
          <span className="biz-sidebar-brand-icon"><Gear size={16} color="var(--lime)" weight="fill" /></span>
          <span>Gears</span>
        </div>

        <button className="biz-sidebar-switcher" onClick={() => setMenuOpen(true)}>
          <BizAccountAvatar name={mechanic?.name} />
          <span className="biz-sidebar-switcher-text">
            <span className="biz-sidebar-switcher-name">{mechanic?.name}</span>
            <span className="biz-sidebar-switcher-type">
              <BizAccountTypeIcon specialty={mechanic?.specialty} />
              {businessTypeLabel(mechanic?.specialty)}
            </span>
          </span>
          <CaretDown size={13} className="biz-sidebar-switcher-caret" />
        </button>

        <nav className="biz-sidebar-nav">
          {TAB_ITEMS.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`biz-tab-btn ${activeTab === key ? 'active' : ''}`}
              onClick={() => { setShowAddSheet(false); setActiveTab(key); }}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="biz-main">
        <header className="biz-header">
          <button className="biz-back-btn" onClick={() => setMenuOpen(true)} aria-label="Menu">
            <List size={22} />
          </button>
          <h1>{PAGE_TITLES[activeTab] || 'Your Business'}</h1>
          <div className="biz-header-actions">
            <button className="biz-header-icon-btn" aria-label="QR code">
              <QrCode size={18} />
            </button>
            <BizAvatar user={user} onClick={() => setMenuOpen(true)} />
          </div>
        </header>

        {/* Desktop-only equivalent of the mobile header above. */}
        <div className="biz-topbar">
          <span className="biz-topbar-crumb">{PAGE_TITLES[activeTab] || 'Home'}</span>
          <div className="biz-topbar-search">
            <MagnifyingGlass size={15} />
            <span>Search</span>
            <span className="biz-topbar-search-kbd">⌘K</span>
          </div>
          <div className="biz-topbar-actions">
            <button className="biz-header-icon-btn" aria-label="History"><ClockCounterClockwise size={17} /></button>
            <button className="biz-header-icon-btn" aria-label="Notifications"><Bell size={17} /></button>
            <button className="biz-header-icon-btn" aria-label="Apps"><SquaresFour size={17} /></button>
          </div>
        </div>

        {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)}></div>}
        {menuOpen && (
          <div className="biz-menu">
            {businesses && businesses.length > 1 && (
              <>
                <div className="biz-menu-section-label">Accounts</div>
                <div className="biz-account-list">
                  {businesses.map((b) => (
                    <button
                      key={b.id}
                      className={`biz-account-row ${b.id === mechanic?.id ? 'active' : ''}`}
                      onClick={() => { setMenuOpen(false); onSwitchBusiness?.(b.id); }}
                    >
                      <BizAccountAvatar name={b.name} />
                      <span className="biz-account-row-text">
                        <span className="biz-account-row-name">{b.name}</span>
                        <span className="biz-account-row-type">
                          <BizAccountTypeIcon specialty={b.specialty} />
                          {businessTypeLabel(b.specialty)}
                        </span>
                      </span>
                      {b.id === mechanic?.id && <Check size={16} weight="bold" className="biz-account-row-check" />}
                    </button>
                  ))}
                </div>
                <div className="biz-menu-divider"></div>
              </>
            )}
            <button
              className="nav-btn"
              onClick={() => { setMenuOpen(false); onExit(); }}
            >
              <ArrowsLeftRight size={20} />
              <span className="nav-text">Switch to Customer View</span>
            </button>
          </div>
        )}

        <div className="biz-content">
          {activeTab === 'home' && <h2 className="biz-greeting">{timeGreeting()}, {firstName}</h2>}
          {activeTab === 'home' && <BizHomeTab mechanic={mechanic} />}
          {activeTab === 'catalog' && <BizCatalogTab mechanic={mechanic} user={user} show={show} pendingAdd={pendingAdd} onAddHandled={() => setPendingAdd(null)} />}
          {activeTab === 'map' && <BizMapTab mechanic={mechanic} onUpdateLocation={onUpdateLocation} show={show} />}
          {activeTab === 'media' && <BizMediaTab mechanic={mechanic} user={user} show={show} pendingAdd={pendingAdd} onAddHandled={() => setPendingAdd(null)} />}
        </div>

        <div className={`biz-bottom-bar ${showAddSheet ? 'add-open' : ''}`}>
          <nav className="biz-tab-nav">
            {TAB_ITEMS.map(({ key, label, Icon }) => (
              <button
                key={key}
                className={`biz-tab-btn ${activeTab === key ? 'active' : ''}`}
                onClick={() => { setShowAddSheet(false); setActiveTab(key); }}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className={`biz-add-sheet ${showAddSheet ? 'open' : ''}`} aria-hidden={!showAddSheet}>
          <button className="biz-add-option" onClick={() => handleAddOption('product')} tabIndex={showAddSheet ? 0 : -1}>
            <ListPlus size={20} className="biz-add-option-icon" />
            <div className="biz-add-option-text">
              <span className="biz-add-option-title"><span className="regular">Add New </span><span className="bold">Product</span></span>
              <span className="biz-add-option-sub">List an item customers can order</span>
            </div>
          </button>
          <button className="biz-add-option" onClick={() => handleAddOption('service')} tabIndex={showAddSheet ? 0 : -1}>
            <Gear size={20} className="biz-add-option-icon" />
            <div className="biz-add-option-text">
              <span className="biz-add-option-title"><span className="regular">Add New </span><span className="bold">Service</span></span>
              <span className="biz-add-option-sub">Add a service you offer</span>
            </div>
          </button>
          <button className="biz-add-option" onClick={() => handleAddOption('media')} tabIndex={showAddSheet ? 0 : -1}>
            <ImageSquare size={20} className="biz-add-option-icon" />
            <div className="biz-add-option-text">
              <span className="biz-add-option-title"><span className="regular">Upload An </span><span className="bold">Image</span><span className="regular"> Or </span><span className="bold">Video</span></span>
              <span className="biz-add-option-sub">Showcase your work with photos or videos</span>
            </div>
          </button>
        </div>

        <button
          className={`biz-add-fab ${showAddSheet ? 'open' : ''}`}
          onClick={() => { playTapSound(); setShowAddSheet((v) => !v); }}
          aria-label={showAddSheet ? 'Close add menu' : 'Add product, service or media'}
        >
          <Plus size={24} weight="bold" />
        </button>
      </div>

        <div
          className={`biz-add-sheet-overlay ${showAddSheet ? 'open' : ''}`}
          onClick={() => setShowAddSheet(false)}
          aria-hidden={!showAddSheet}
        ></div>
      </div>
    </div>
  );
}

function BizHomeTab({ mechanic }) {
  const stats = [
    { label: 'Visits', icon: Eye },
    { label: 'Calls', icon: Phone },
    { label: 'Searches', icon: MagnifyingGlass },
    { label: 'Bookmarks', icon: BookmarkSimple },
  ];

  return (
    <div className="biz-home-tab">
      <div className="biz-stats-grid">
        {stats.map(({ label, icon: Icon }) => (
          <div key={label} className="biz-stat-tile">
            <div className="biz-stat-tile-top">
              <Icon size={18} />
              <span>{label}</span>
            </div>
            <strong>—</strong>
            <span className="biz-stat-tile-note">Coming soon</span>
          </div>
        ))}
      </div>

      <div className="biz-info-card">
        <h3>Listing details</h3>
        {mechanic ? (
          <dl>
            <dt>Area</dt>
            <dd>{mechanic.area || '—'}</dd>
            <dt>Phone</dt>
            <dd>{mechanic.phone || '—'}</dd>
            <dt>Category</dt>
            <dd>{mechanic.specialty || '—'}</dd>
          </dl>
        ) : (
          <p className="biz-empty-text" style={{ padding: 0, textAlign: 'left' }}>You don't have a listing yet.</p>
        )}
      </div>
    </div>
  );
}

function BizCatalogTab({ mechanic, user, show, pendingAdd, onAddHandled }) {
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState('products');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewTab, setPreviewTab] = useState('details'); // 'details' | 'listing'
  const [saving, setSaving] = useState(false);
  const [emptyStateStep, setEmptyStateStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setEmptyStateStep((s) => s + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const emptyStateCenterIndex = emptyStateStep % 3;
  const emptyStateCaption = emptyStateStep === 0 ? 'Your First Product' : CATALOG_EMPTY_ITEMS[emptyStateCenterIndex].name;
  const typedEmptyStateCaption = useTypewriter(emptyStateCaption);

  useEffect(() => {
    if (pendingAdd === 'product' || pendingAdd === 'service') {
      setKind(pendingAdd === 'service' ? 'services' : 'products');
      setShowForm(true);
      onAddHandled?.();
    }
  }, [pendingAdd, onAddHandled]);

  useEffect(() => {
    if (!db || !mechanic?.id) return;
    const unsubProducts = onSnapshot(query(collection(db, `mechanics/${mechanic.id}/products`)), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, collectionName: 'products', ...d.data() })));
    });
    const unsubServices = onSnapshot(query(collection(db, `mechanics/${mechanic.id}/services`)), (snap) => {
      setServices(snap.docs.map((d) => ({ id: d.id, collectionName: 'services', ...d.data() })));
    });
    return () => { unsubProducts(); unsubServices(); };
  }, [mechanic?.id]);

  const items = [...products, ...services];

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setPhotoUrl('');
    setPreviewing(false);
    setPreviewTab('details');
    setShowForm(false);
  };

  const handlePreview = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setPreviewTab('details');
    setPreviewing(true);
  };

  const handlePublish = async () => {
    if (!db || !mechanic?.id) return;
    setSaving(true);
    try {
      await addDoc(collection(db, `mechanics/${mechanic.id}/${kind}`), {
        name: name.trim(),
        description: description.trim(),
        price: price.trim(),
        ...(photoUrl.trim() ? { imageUrl: photoUrl.trim() } : {}),
        inStock: true,
        addedBy: user.uid,
        createdAt: new Date().toISOString(),
      });
      resetForm();
      show?.(`${kind === 'products' ? 'Product' : 'Service'} published!`);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleStock = async (item) => {
    if (!db) return;
    await updateDoc(doc(db, `mechanics/${mechanic.id}/${item.collectionName}`, item.id), {
      inStock: !(item.inStock !== false),
    });
  };

  const handleDelete = async (item) => {
    if (!db) return;
    await deleteDoc(doc(db, `mechanics/${mechanic.id}/${item.collectionName}`, item.id));
    show?.('Removed.');
  };

  if (!mechanic?.id) {
    return (
      <div className="biz-catalog-tab">
        <div className="biz-catalog-header">
          <h3>Products & Services</h3>
        </div>
        <p className="biz-empty-text">Add your business details to start building your catalog.</p>
      </div>
    );
  }

  return (
    <div className="biz-catalog-tab">

      {showForm && !previewing && (
        <form className="biz-catalog-form business-fields" onSubmit={handlePreview}>
          <div className="biz-catalog-form-header">
            <h4>Add New {kind === 'products' ? 'Product' : 'Service'}</h4>
            <button type="button" className="biz-catalog-form-close" onClick={resetForm} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className="biz-catalog-form-kind">
            <button type="button" className={kind === 'products' ? 'active' : ''} onClick={() => setKind('products')}>Product</button>
            <button type="button" className={kind === 'services' ? 'active' : ''} onClick={() => setKind('services')}>Service</button>
          </div>
          <label>Title
            <input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>Description
            <textarea placeholder="Items, Pickup Details or Instructions" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>Price (₵)
            <input placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label>Photos
            <input placeholder="Image URL" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
          </label>
          <div className="biz-catalog-form-actions">
            <button type="button" onClick={resetForm}>Cancel</button>
            <button type="submit" className="biz-primary-btn small">Preview</button>
          </div>
        </form>
      )}

      {showForm && previewing && (
        <div className="biz-preview">
          <div className="biz-preview-topbar">
            <button type="button" className="biz-preview-back" onClick={() => setPreviewing(false)} aria-label="Back to editing">
              <CaretLeft size={18} />
            </button>
            <div className="biz-preview-tabs">
              <button type="button" className={previewTab === 'details' ? 'active' : ''} onClick={() => setPreviewTab('details')}>Details Page</button>
              <button type="button" className={previewTab === 'listing' ? 'active' : ''} onClick={() => setPreviewTab('listing')}>Listing Page</button>
            </div>
          </div>

          <div className="biz-preview-body">
            {previewTab === 'details' ? (
              <>
                <div className="item-sheet-image" style={{ background: photoUrl ? undefined : '#f5e6c8' }}>
                  {photoUrl && <img src={photoUrl} alt={name} />}
                </div>
                <div className="item-sheet-body biz-preview-item-sheet-body">
                  {mechanic?.name && (
                    <div className="item-sheet-shop">
                      <div className="item-sheet-shop-avatar">{mechanic.name.charAt(0).toUpperCase()}</div>
                      <span className="item-sheet-shop-name">{mechanic.name}</span>
                    </div>
                  )}
                  <h3 className="item-sheet-name">{name || 'Untitled'}</h3>
                  {price && (
                    <p className="item-sheet-price">
                      ₵{kind === 'services' && !price.trim().endsWith('+') ? `${price}+` : price}
                    </p>
                  )}
                  {description && <p className="item-sheet-desc">{description}</p>}
                </div>
              </>
            ) : (
              <div className="biz-preview-listing-card">
                <div className="service-card-image" style={{ background: photoUrl ? undefined : '#f5e6c8' }}>
                  {photoUrl && <img src={photoUrl} alt={name} />}
                </div>
                <div className="service-card-row">
                  <div className="service-card-body">
                    <h4 className="service-card-name">{name || 'Untitled'}</h4>
                    {description && <p className="service-card-desc">{description}</p>}
                  </div>
                  {price && <span className="service-card-price">GH₵ {price}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="biz-preview-footer">
            <button type="button" className="biz-preview-publish-btn" onClick={handlePublish} disabled={saving}>
              {saving ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !showForm && (
        <div className="biz-catalog-empty">
          <div className="biz-catalog-empty-stack">
            {CATALOG_EMPTY_ITEMS.map((item, i) => {
              const relative = (i - emptyStateCenterIndex + 3) % 3;
              const slot = CATALOG_EMPTY_SLOTS[CATALOG_EMPTY_SLOT_FOR_RELATIVE[relative]];
              return (
                <div
                  key={item.name}
                  className="biz-catalog-empty-card"
                  style={{
                    left: slot.left,
                    top: slot.top,
                    transform: `rotate(${slot.rotate}deg)`,
                    zIndex: slot.z,
                    background: item.bg,
                  }}
                >
                  <img src={item.image} alt="" />
                </div>
              );
            })}
          </div>
          <div className="biz-catalog-empty-caption">
            <strong>
              {typedEmptyStateCaption}
              <span className="biz-catalog-empty-caret" />
            </strong>
            <span className="biz-catalog-empty-price">
              <span>₵</span>
              <span className="biz-catalog-empty-price-bar" />
            </span>
          </div>
          <p className="biz-catalog-empty-heading">
            List your products and services to show up in more customer searches.
          </p>
          <button type="button" className="biz-catalog-empty-btn" onClick={() => { setKind('products'); setShowForm(true); }}>
            <Plus size={24} weight="bold" />
            Add Your First Product
          </button>
        </div>
      )}

      <div className="biz-catalog-list">
        {items.map((item) => (
          <div key={`${item.collectionName}-${item.id}`} className="biz-catalog-row">
            <div className="biz-catalog-row-main">
              <strong>{item.name}</strong>
              <span className="biz-catalog-row-meta">
                {item.collectionName === 'products' ? 'Product' : 'Service'}
                {item.price ? ` · GH₵${item.price}` : ''}
              </span>
            </div>
            <div className="biz-catalog-row-actions">
              <button
                className={`biz-stock-toggle ${item.inStock !== false ? 'on' : 'off'}`}
                onClick={() => toggleStock(item)}
                title={item.inStock !== false ? 'In stock' : 'Out of stock'}
              >
                {item.inStock !== false ? <ToggleRight size={26} weight="fill" /> : <ToggleLeft size={26} />}
              </button>
              <button className="biz-icon-btn" onClick={() => handleDelete(item)} title="Delete">
                <Trash size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Same map component the onboarding wizard uses to pick a location in the
// first place (LocationPicker: draggable pin, category marker, CARTO tiles)
// — so adjusting a listing's pin afterward looks and behaves identically to
// setting it during onboarding, instead of a separate read-only preview.
function BizMapTab({ mechanic, onUpdateLocation, show }) {
  const [lat, setLat] = useState(mechanic?.lat ?? null);
  const [lng, setLng] = useState(mechanic?.lng ?? null);
  const skipNextPersist = useRef(true);

  useEffect(() => {
    setLat(mechanic?.lat ?? null);
    setLng(mechanic?.lng ?? null);
    skipNextPersist.current = true;
  }, [mechanic?.id]);

  useEffect(() => {
    if (skipNextPersist.current) { skipNextPersist.current = false; return; }
    if (lat == null || lng == null) return;
    onUpdateLocation?.(mechanic.id, lat, lng);
    show?.('Location updated');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  if (lat == null || lng == null) {
    return <div className="biz-empty-text" style={{ padding: '24px' }}>No location set for this listing.</div>;
  }

  return (
    <div className="biz-map-tab">
      <h3>Your Location</h3>
      <p className="biz-map-hint">Drag the pin to update where customers see you.</p>
      <div className="biz-map-frame">
        <MapContainer center={[lat, lng]} zoom={16} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} subdomains={TILE_SUBDOMAINS} maxNativeZoom={18} maxZoom={20} />
          <LocationPicker lat={lat} lng={lng} setLat={setLat} setLng={setLng} category={mechanic.specialty} label={mechanic.name} />
        </MapContainer>
      </div>
      <p className="biz-map-address">{mechanic.area}</p>
    </div>
  );
}

const MEDIA_CATEGORIES = [
  { key: 'general', label: 'General' },
  { key: 'products', label: 'Products' },
  { key: 'services', label: 'Services' },
];

function BizMediaTab({ mechanic, user, show, pendingAdd, onAddHandled }) {
  const [media, setMedia] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('general');
  const [activeFilter, setActiveFilter] = useState('all');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pendingAdd === 'media') {
      setShowForm(true);
      onAddHandled?.();
    }
  }, [pendingAdd, onAddHandled]);

  useEffect(() => {
    if (!db || !mechanic?.id) return;
    const unsub = onSnapshot(query(collection(db, `mechanics/${mechanic.id}/media`)), (snap) => {
      setMedia(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [mechanic?.id]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!url.trim() || !db || !mechanic?.id) return;
    setSaving(true);
    try {
      await addDoc(collection(db, `mechanics/${mechanic.id}/media`), {
        imageUrl: url.trim(),
        ...(label.trim() ? { label: label.trim() } : {}),
        category,
        addedBy: user.uid,
        createdAt: new Date().toISOString(),
      });
      setUrl('');
      setLabel('');
      setCategory('general');
      setShowForm(false);
      show?.('Photo added!');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!db) return;
    await deleteDoc(doc(db, `mechanics/${mechanic.id}/media`, item.id));
  };

  if (!mechanic?.id) {
    return (
      <div className="biz-media-tab">
        <div className="biz-catalog-header">
          <h3>Media</h3>
        </div>
        <p className="biz-empty-text">Add your business details to start adding photos.</p>
      </div>
    );
  }

  // Media added before categories existed has no `category` field — treat
  // it as "General" rather than hiding it from every filter but "All".
  const filteredMedia = activeFilter === 'all' ? media : media.filter((m) => (m.category || 'general') === activeFilter);

  return (
    <div className="biz-media-tab">
      <div className="biz-catalog-header">
        <h3>Media</h3>
        <button className="biz-add-btn" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} weight="bold" /> Add
        </button>
      </div>

      {showForm && (
        <form className="biz-catalog-form business-fields" onSubmit={handleAdd}>
          <label>Image URL
            <input required placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <label>Caption (optional)
            <input placeholder="e.g. Workshop front" value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <div className="biz-catalog-form-kind">
            {MEDIA_CATEGORIES.map((c) => (
              <button type="button" key={c.key} className={category === c.key ? 'active' : ''} onClick={() => setCategory(c.key)}>{c.label}</button>
            ))}
          </div>
          <div className="biz-catalog-form-actions">
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="biz-primary-btn small" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}

      {media.length > 0 && (
        <div className="biz-media-filters">
          <button className={activeFilter === 'all' ? 'active' : ''} onClick={() => setActiveFilter('all')}>All</button>
          {MEDIA_CATEGORIES.map((c) => (
            <button key={c.key} className={activeFilter === c.key ? 'active' : ''} onClick={() => setActiveFilter(c.key)}>{c.label}</button>
          ))}
        </div>
      )}

      {media.length === 0 && !showForm && (
        <p className="biz-empty-text">No photos yet. Add some to showcase your business.</p>
      )}

      {media.length > 0 && filteredMedia.length === 0 && (
        <p className="biz-empty-text">Nothing in this category yet.</p>
      )}

      <div className="biz-media-grid">
        {filteredMedia.map((item) => (
          <div key={item.id} className="biz-media-item">
            <div className="biz-media-cell">
              <img src={item.imageUrl} alt="" />
              <button className="biz-media-delete" onClick={() => handleDelete(item)} aria-label="Delete">
                <X size={14} weight="bold" />
              </button>
            </div>
            {item.label && <span className="biz-media-item-label">{item.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
