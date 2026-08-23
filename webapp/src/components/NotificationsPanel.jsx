import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { Check, BellSimpleRinging } from '@phosphor-icons/react';
import { db } from '../firebase';
import { formatRelativeTime } from '../recentInteractions';
import {
  BookmarkIcon,
  LocationIcon,
  StarRatingIcon,
  ShopIcon,
  CarDetailingIcon,
  FillingStationIcon,
  NotificationIcon,
} from './icons';

const TYPE_META = {
  rating: { icon: StarRatingIcon, color: '#FB8C00', bg: '#FFF3E0' },
  order: { icon: ShopIcon, color: '#155e42', bg: '#E8F5E9' },
  price: { icon: BookmarkIcon, color: '#6D28D9', bg: '#F3E8FF' },
  nearby: { icon: LocationIcon, color: '#2477E8', bg: '#E3F2FD' },
  'new-listing': { icon: NotificationIcon, color: '#6D28D9', bg: '#F3E8FF' },
  verify: { icon: StarRatingIcon, color: '#155e42', bg: '#E8F5E9' },
  promo: { icon: NotificationIcon, color: '#C2185B', bg: '#FCE4EC' },
  fuel: { icon: FillingStationIcon, color: '#2477E8', bg: '#E3F2FD' },
  bookmark: { icon: BookmarkIcon, color: '#155e42', bg: '#E8F5E9' },
};

// "Today" / "Yesterday" / "Earlier" by calendar day, not elapsed hours, so a
// notification from 11pm yesterday and one from 1am today land in the right
// bucket even though they're only two hours apart.
function dayBucket(date) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (date >= startOfToday) return 'Today';
  if (date >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

function formatNotificationTime(date, bucket) {
  if (bucket === 'Today') return formatRelativeTime(date.getTime());
  if (bucket === 'Yesterday') return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function groupByDay(notifications) {
  const order = ['Today', 'Yesterday', 'Earlier'];
  const groups = order.map((key) => ({ key, items: [] }));
  for (const n of notifications) {
    groups.find((g) => g.key === n.bucket).items.push(n);
  }
  return groups.filter((g) => g.items.length > 0);
}

export default function NotificationsPanel({ onOpenSidebar, onSelectMechanic, mechanics, user }) {
  const [rawNotifications, setRawNotifications] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    if (!db || !user) {
      setRawNotifications([]);
      return;
    }
    const notificationsQuery = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
    );
    const unsubscribe = onSnapshot(notificationsQuery, (snap) => {
      setRawNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setRawNotifications([]));
    return unsubscribe;
  }, [user?.uid]);

  const notifications = useMemo(() => rawNotifications.map((n) => {
    const date = n.createdAt?.toDate ? n.createdAt.toDate() : new Date();
    const bucket = dayBucket(date);
    return { ...n, date, bucket, time: formatNotificationTime(date, bucket) };
  }), [rawNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const filtered = useMemo(() => {
    if (activeFilter === 'Unread') return notifications.filter(n => !n.read);
    return notifications;
  }, [notifications, activeFilter]);

  const groups = groupByDay(filtered);

  const markAllRead = () => {
    if (!db || !user) return;
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => batch.update(doc(db, 'users', user.uid, 'notifications', n.id), { read: true }));
    batch.commit().catch(() => {});
  };

  const markRead = (id) => {
    if (!db || !user) return;
    updateDoc(doc(db, 'users', user.uid, 'notifications', id), { read: true }).catch(() => {});
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
