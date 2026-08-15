import React, { useMemo, useState } from 'react';
import { Check, ClockCounterClockwise, BellSimpleRinging } from '@phosphor-icons/react';
import {
  BookmarkIcon,
  LocationIcon,
  StarRatingIcon,
  ShopIcon,
  CarDetailingIcon,
  FillingStationIcon,
  NotificationIcon,
} from './icons';

// ---------------------------------------------------------------------------
// Mock notification store — in production this would come from Firestore.
// ---------------------------------------------------------------------------
const MOCK_NOTIFICATIONS = [
  { id: 'n1', type: 'rating', title: 'Kofi A. rated IK_AD Automobile Works', description: 'Left a 5-star review: "Sent updates and pictures throughout."', time: '2m ago', read: false, mechanicId: 'mock-1' },
  { id: 'n2', type: 'order', title: 'Order confirmed', description: 'Bosch Spark Plug Set (4pc) is being prepared by IK_AD Automobile Works.', time: '1h ago', read: false, mechanicId: 'mock-1' },
  { id: 'n3', type: 'price', title: 'Price drop on something you saved', description: 'Engine Oil 5L dropped from ₵120 to ₵98 at Circle Auto Parts.', time: '3h ago', read: false, mechanicId: 'mock-2' },
  { id: 'n4', type: 'nearby', title: '3 new detailers near you', description: 'Aura Detailers, Sparkle Auto Care and 1 more just joined Gears in Osu.', time: 'Yesterday', read: true },
  { id: 'n5', type: 'verify', title: 'Your listing was verified', description: 'IK_AD Automobile Works is now verified by the Gears team.', time: 'Yesterday', read: true, mechanicId: 'mock-1' },
  { id: 'n6', type: 'promo', title: 'Weekend detailing special', description: '20% off full interior detailing at participating shops this weekend.', time: '2d ago', read: true },
  { id: 'n7', type: 'fuel', title: 'Fuel price update', description: 'Petrol prices changed at 5 stations near Adum, Kumasi.', time: '3d ago', read: true },
  { id: 'n8', type: 'bookmark', title: 'Reminder: saved mechanic is open', description: 'IK_AD Automobile Works is open now — Mon–Sat · 7:00 AM – 6:00 PM.', time: '5d ago', read: true, mechanicId: 'mock-1' },
];

const TYPE_META = {
  rating: { icon: StarRatingIcon, color: '#FB8C00', bg: '#FFF3E0' },
  order: { icon: ShopIcon, color: '#155e42', bg: '#E8F5E9' },
  price: { icon: BookmarkIcon, color: '#6D28D9', bg: '#F3E8FF' },
  nearby: { icon: LocationIcon, color: '#2477E8', bg: '#E3F2FD' },
  verify: { icon: StarRatingIcon, color: '#155e42', bg: '#E8F5E9' },
  promo: { icon: NotificationIcon, color: '#C2185B', bg: '#FCE4EC' },
  fuel: { icon: FillingStationIcon, color: '#2477E8', bg: '#E3F2FD' },
  bookmark: { icon: BookmarkIcon, color: '#155e42', bg: '#E8F5E9' },
};

function groupByDay(notifications) {
  const groups = [];
  const today = new Set();
  const seen = new Set();
  const order = ['Today', 'Yesterday', 'Earlier'];
  for (const n of notifications) {
    const key = n.time.includes('ago') ? 'Today' : n.time === 'Yesterday' ? 'Yesterday' : 'Earlier';
    if (!seen.has(key)) { seen.add(key); groups.push({ key, items: [] }); }
    groups.find(g => g.key === key).items.push(n);
  }
  return groups.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

export default function NotificationsPanel({ onOpenSidebar, onSelectMechanic, mechanics }) {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState('All');

  const unreadCount = notifications.filter(n => !n.read).length;

  const filtered = useMemo(() => {
    if (activeFilter === 'Unread') return notifications.filter(n => !n.read);
    return notifications;
  }, [notifications, activeFilter]);

  const groups = groupByDay(filtered);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const resolveMechanic = (notification) => {
    if (!notification.mechanicId) return null;
    return mechanics.find(m => m.id === notification.mechanicId) || null;
  };

  return (
    <div className="notifications-panel">
      <div className="fullpage-header">
        <button className="fullpage-back-btn" onClick={onOpenSidebar} aria-label="Menu">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="fullpage-title">Notifications</h1>
        <div className="fullpage-spacer" />
      </div>

      <div className="notif-tabs">
        {['All', 'Unread'].map(tab => (
          <button
            key={tab}
            className={`notif-tab ${activeFilter === tab ? 'active' : ''}`}
            onClick={() => setActiveFilter(tab)}
          >
            {tab}
            {tab === 'Unread' && unreadCount > 0 && <span className="notif-tab-badge">{unreadCount}</span>}
          </button>
        ))}
        {unreadCount > 0 && (
          <button className="notif-mark-read" onClick={markAllRead} aria-label="Mark all as read">
            <Check size={14} />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      <div className="notif-scroll">
        {filtered.length === 0 ? (
          <div className="notif-empty">
            <div className="notif-empty-icon">
              <BellSimpleRinging size={32} />
            </div>
            <h3>You're all caught up</h3>
            <p>When something happens on Gears — new reviews, price drops, or nearby mechanics — it will show up here.</p>
          </div>
        ) : (
          groups.map(group => (
            <section key={group.key} className="notif-group">
              <h3 className="notif-group-label">{group.key}</h3>
              {group.items.map(n => {
                const meta = TYPE_META[n.type] || TYPE_META.promo;
                const Icon = meta.icon;
                const mechanic = resolveMechanic(n);
                return (
                  <button
                    key={n.id}
                    className={`notif-card ${!n.read ? 'notif-card--unread' : ''}`}
                    onClick={() => {
                      markRead(n.id);
                      if (mechanic && onSelectMechanic) onSelectMechanic(mechanic);
                    }}
                  >
                    <div className="notif-card-icon" style={{ background: meta.bg, color: meta.color }}>
                      <Icon size={20} state={n.type === 'rating' || n.type === 'verify' ? 'filled' : 'default'} />
                    </div>
                    <div className="notif-card-body">
                      <div className="notif-card-row">
                        <h4 className="notif-card-title">{n.title}</h4>
                        <span className="notif-card-time">{n.time}</span>
                      </div>
                      <p className="notif-card-desc">{n.description}</p>
                    </div>
                    {!n.read && <span className="notif-card-dot" />}
                  </button>
                );
              })}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
