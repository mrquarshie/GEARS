import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { X, Pencil, Trash, Plus, MapPin, Clock, Phone, Wrench } from '@phosphor-icons/react';
import { collection, addDoc, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import {
  BookmarkIcon,
  CallIcon,
  LocationIcon,
  RateIcon,
  ShareIcon,
  StarRatingIcon,
} from './icons';

function getCategory(specialty) {
  if (specialty === 'Car Detailing') return 'detailer';
  if (specialty === 'Fuel Station') return 'fuel';
  return 'standard'; // mechanics + car-parts shops share the same page structure
}

export default function MechanicDetailPanel({ mechanic, onClose, user, onEdit, onDelete, onRate, savedMechanics, onToggleSave, onDirection }) {
  const [activeTab, setActiveTab] = useState('Overview');

  useEffect(() => {
    setActiveTab('Overview');
  }, [mechanic?.id]);

  if (!mechanic) return null;

  const category = getCategory(mechanic.specialty);
  const hasProducts = (mechanic.products?.length || 0) > 0;
  const hasServices = (mechanic.services?.length || 0) > 0;

  const tabs = category === 'detailer'
    ? ['Overview', 'Packages', 'Reviews', 'Media']
    : category === 'fuel'
    ? ['Overview', 'Fuel Prices', 'Reviews', 'Media']
    : ['Overview', ...(hasProducts ? ['Products'] : []), ...(hasServices ? ['Services'] : []), 'Reviews', 'Media'];

  const isCreator = user && user.uid === mechanic.createdBy;

  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    "name": mechanic.name,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": mechanic.area,
      "addressCountry": "GH"
    },
    "telephone": mechanic.phone,
    "url": window.location.href
  };

  return (
    <>
      <div className="mechanic-detail-overlay" onClick={onClose}></div>
      <div className="mechanic-detail-panel">
        <Helmet>
          <title>{mechanic.name} - Mechanic in {mechanic.area} | Gears</title>
          <meta name="description" content={`Contact ${mechanic.name} in ${mechanic.area}. Specialty: ${mechanic.specialty || 'General Repairs'}. Call ${mechanic.phone}.`} />
          <script type="application/ld+json">
            {JSON.stringify(schemaMarkup)}
          </script>
        </Helmet>

      <button className="close-panel-btn" onClick={onClose} aria-label="Close"><X size={18}/></button>

      <div className="detail-cover">
        <div className="rating-badge-large">
          <span className="rating-score"><StarRatingIcon size={12} state="filled" color="white" /> {mechanic.rating !== 'New' ? Number(mechanic.rating).toFixed(1) : 'New'}</span>
          <span className="rating-count">Reviews<br/>{mechanic.ratingCount}</span>
        </div>
      </div>

      <div className="detail-header">
        <div className="detail-avatar-container">
          <div className="detail-avatar">
             <span className="avatar-letter">{mechanic.name.charAt(0).toUpperCase()}</span>
          </div>
        </div>
        <h2 className="detail-name">{mechanic.name}</h2>
        <p className="detail-area">{mechanic.area}{mechanic.distance ? ` · ${mechanic.distance} away` : ''}</p>

        {isCreator && (
          <div className="creator-actions">
            <button className="edit-btn" onClick={() => onEdit(mechanic)}><Pencil size={14}/> Edit</button>
            <button className="delete-btn" onClick={() => onDelete(mechanic)}><Trash size={14}/> Delete</button>
          </div>
        )}
      </div>

      <div className="detail-tabs">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="detail-content">
        {activeTab === 'Overview' && <OverviewTab mechanic={mechanic} category={category} onRate={onRate} />}
        {activeTab === 'Products' && <ListItemsTab mechanicId={mechanic.id} collectionName="products" user={user} itemName="Product" fallbackItems={mechanic.products} />}
        {activeTab === 'Services' && <ListItemsTab mechanicId={mechanic.id} collectionName="services" user={user} itemName="Service" fallbackItems={mechanic.services} />}
        {activeTab === 'Packages' && <ListItemsTab mechanicId={mechanic.id} collectionName="packages" user={user} itemName="Package" fallbackItems={mechanic.packages} />}
        {activeTab === 'Fuel Prices' && <FuelPricesTab fuelPrices={mechanic.fuelPrices} />}
        {activeTab === 'Media' && <MediaTab mechanicId={mechanic.id} user={user} fallbackMedia={mechanic.media} />}
        {activeTab === 'Reviews' && <ReviewsTab mechanicId={mechanic.id} mechanic={mechanic} fallbackReviews={mechanic.reviews} />}
      </div>

      <div className="detail-bottom-bar">
        <div className="detail-bottom-left">
          <button className="icon-btn" onClick={() => onToggleSave(mechanic)}>
            <BookmarkIcon size={18} state={savedMechanics.includes(mechanic.id) ? 'filled' : 'default'} color={savedMechanics.includes(mechanic.id) ? 'var(--forest)' : 'currentColor'} />
          </button>
          <button className="icon-btn" onClick={() => onRate(mechanic)}><RateIcon size={18} /></button>
          <button className="icon-btn"><ShareIcon size={18} /></button>
        </div>
        <div className="card-actions-divider"></div>
        <div className="detail-bottom-right">
          <button
            type="button"
            className="icon-btn"
            onClick={() => onDirection(mechanic)}
            aria-label="Direction"
          >
            <LocationIcon size={16} />
          </button>
          <button
            className="action-btn"
            onClick={() => window.location.href = `tel:${mechanic.phone.replace(/\s+/g, '')}`}
          >
            <CallIcon size={16} /> Call
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

function OverviewTab({ mechanic, category, onRate }) {
  const tags = category === 'fuel' ? mechanic.facilities : mechanic.specialties;
  const tagsLabel = category === 'fuel' ? 'Facilities' : 'Specialties';

  return (
    <div className="tab-content overview-tab">
      {category !== 'fuel' && (
        <div className="overview-section">
          <h3><Wrench size={15} weight="bold"/> About</h3>
          <p>{mechanic.about || `Specialising in ${mechanic.specialty || 'general repairs'} for local and foreign vehicles.`}</p>
        </div>
      )}

      <div className="overview-section">
        <h3><MapPin size={15} weight="bold"/> Location</h3>
        <p>{mechanic.locationDetail || mechanic.area}</p>
      </div>

      <div className="overview-section">
        <h3><Clock size={15} weight="bold"/> Opening Days</h3>
        <p>{mechanic.hours || (mechanic.open ? 'Open Now' : 'Closed')}</p>
      </div>

      <div className="overview-section">
        <h3><Phone size={15} weight="bold"/> Contact</h3>
        <p>{mechanic.phone || 'Not provided'}</p>
      </div>

      {tags && tags.length > 0 && (
        <div className="overview-section">
          <h3>{tagsLabel}</h3>
          <div className="specialty-tags">
            {tags.map(tag => <span key={tag} className="specialty-tag">{tag}</span>)}
          </div>
        </div>
      )}

      <button className="rate-this-btn" onClick={() => onRate(mechanic)}>
        Rate this listing <RateIcon size={16}/>
      </button>
    </div>
  );
}

function FuelPricesTab({ fuelPrices }) {
  if (!fuelPrices || fuelPrices.length === 0) {
    return <div className="tab-content"><p>No fuel prices listed yet.</p></div>;
  }
  return (
    <div className="tab-content">
      <div className="fuel-price-list">
        {fuelPrices.map(f => (
          <div key={f.type} className="fuel-price-row">
            <span className="fuel-price-dot" style={{ background: f.color || 'var(--forest)' }}></span>
            <span className="fuel-price-name">{f.type}</span>
            <span className="fuel-price-value">GH₵{f.price}<span className="fuel-price-unit">/{f.unit}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewsTab({ mechanicId, mechanic, fallbackReviews }) {
  const [reviews, setReviews] = useState(fallbackReviews || []);
  const [loading, setLoading] = useState(!!db);

  useEffect(() => {
    if (!db || !mechanicId) return;
    const q = query(collection(db, `mechanics/${mechanicId}/ratings`), orderBy('ratedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [mechanicId]);

  if (loading) return <div className="tab-content"><p>Loading reviews...</p></div>;

  const avg = mechanic.rating !== 'New' ? Number(mechanic.rating).toFixed(1) : null;

  return (
    <div className="tab-content">
      {avg && (
        <div className="reviews-summary">
          <div className="reviews-summary-score">{avg}</div>
          <div className="reviews-summary-stars">
            {[...Array(5)].map((_, i) => <StarRatingIcon key={i} size={16} state={i < Math.round(avg) ? 'filled' : 'default'} />)}
          </div>
          <div className="reviews-summary-count">{mechanic.ratingCount} verified reviews</div>
        </div>
      )}

      {reviews.length === 0 ? (
        <p>No reviews yet. Be the first to rate!</p>
      ) : (
        <div className="reviews-list">
          {reviews.map((rev, i) => (
            <div key={rev.id || i} className="review-card">
              <div className="review-header">
                <div className="review-avatar">{rev.userName ? rev.userName.charAt(0).toUpperCase() : 'A'}</div>
                <div className="review-meta">
                  <h4 className="review-author">{rev.userName || 'Anonymous'}</h4>
                  <div className="review-date">
                    {rev.ratedAt?.toDate ? new Date(rev.ratedAt.toDate()).toLocaleDateString() : (rev.date || 'Recently')}
                  </div>
                </div>
                <div className="review-stars">
                  {[...Array(rev.value || 0)].map((_, i) => <StarRatingIcon key={`filled-${i}`} size={14} state="filled" />)}
                  {[...Array(5 - (rev.value || 0))].map((_, i) => <StarRatingIcon key={`empty-${i}`} size={14} />)}
                </div>
              </div>
              {rev.comment && <p className="review-comment">{rev.comment}</p>}
              {rev.tags && rev.tags.length > 0 && (
                <div className="review-tags">
                  {rev.tags.map(tag => (
                    <span key={tag} className="review-tag-pill">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ListItemsTab({ mechanicId, collectionName, user, itemName, fallbackItems }) {
  const [items, setItems] = useState(fallbackItems || []);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!db || !mechanicId) return;
    const q = query(collection(db, `mechanics/${mechanicId}/${collectionName}`));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [mechanicId, collectionName]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !db) return;
    setSaving(true);
    try {
      await addDoc(collection(db, `mechanics/${mechanicId}/${collectionName}`), {
        name: name.trim(),
        price: price.trim(),
        addedBy: user.uid,
        createdAt: new Date().toISOString()
      });
      setName('');
      setPrice('');
      setShowForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tab-content">
      {user && db && (
        <div style={{ marginBottom: '16px', textAlign: 'right' }}>
          <button className="primary" onClick={() => setShowForm(!showForm)} style={{ padding: '6px 12px', fontSize: '13px' }}>
            <Plus size={14}/> Add {itemName}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} style={{ marginBottom: '20px', padding: '16px', background: '#f4f5f1', borderRadius: '8px' }}>
          <input required placeholder={`${itemName} name`} value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', marginBottom: '8px', padding: '8px' }} />
          <input placeholder="Price (Optional)" value={price} onChange={e => setPrice(e.target.value)} style={{ width: '100%', marginBottom: '12px', padding: '8px' }} />
          <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => setShowForm(false)} style={{ marginLeft: '8px', padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
        </form>
      )}

      {items.length === 0 && !showForm && <p>No {collectionName} listed yet.</p>}

      <div className="item-list">
        {items.map((item, i) => (
          <div key={item.id || i} className="item-row">
            <div className="item-row-main">
              <strong>{item.name}</strong>
              {item.description && <span className="item-row-description">{item.description}</span>}
            </div>
            <div className="item-row-side">
              {item.duration && <span className="item-row-duration">{item.duration}</span>}
              {item.price && <span className="item-row-price">GH₵{item.price}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MediaTab({ mechanicId, user, fallbackMedia }) {
  const [media, setMedia] = useState(fallbackMedia || []);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    if (!db || !mechanicId) return;
    const q = query(collection(db, `mechanics/${mechanicId}/media`));
    const unsub = onSnapshot(q, (snap) => {
      setMedia(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [mechanicId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!url.trim() || !db) return;
    setSaving(true);
    try {
      await addDoc(collection(db, `mechanics/${mechanicId}/media`), {
        url: url.trim(),
        addedBy: user.uid,
        createdAt: new Date().toISOString()
      });
      setUrl('');
      setShowForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const categories = ['All', ...new Set(media.map(m => m.category).filter(Boolean))];
  const visibleMedia = activeCategory === 'All' ? media : media.filter(m => m.category === activeCategory);

  return (
    <div className="tab-content">
      {user && db && (
        <div style={{ marginBottom: '16px', textAlign: 'right' }}>
          <button className="primary" onClick={() => setShowForm(!showForm)} style={{ padding: '6px 12px', fontSize: '13px' }}>
            <Plus size={14}/> Add Photo URL
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} style={{ marginBottom: '20px', padding: '16px', background: '#f4f5f1', borderRadius: '8px' }}>
          <input required type="url" placeholder="https://example.com/photo.jpg" value={url} onChange={e => setUrl(e.target.value)} style={{ width: '100%', marginBottom: '12px', padding: '8px' }} />
          <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => setShowForm(false)} style={{ marginLeft: '8px', padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
        </form>
      )}

      {media.length === 0 && !showForm && <p>No media uploaded yet.</p>}

      {media.length > 0 && categories.length > 1 && (
        <div className="media-filter-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`media-filter-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="media-grid">
        {visibleMedia.map((m, i) => (
          <div key={m.id || i} className="media-tile" style={!m.url ? { background: m.color || '#eee' } : undefined}>
            {m.url ? (
              <img src={m.url} alt={m.label || 'Media'} onError={(e) => e.target.style.display = 'none'} />
            ) : (
              <span className="media-tile-label">{m.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
