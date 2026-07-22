import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { BookmarkSimple, Star, ShareNetwork, MapPin, Phone, X, Pencil, Trash, Plus } from '@phosphor-icons/react';
import { collection, addDoc, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export default function MechanicDetailPanel({ mechanic, onClose, user, onEdit, onDelete, onRate, savedMechanics, onToggleSave }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const tabs = ['Overview', 'Products', 'Services', 'Reviews', 'Media'];

  if (!mechanic) return null;

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
      <button className="close-panel-btn" onClick={onClose}><X size={20}/></button>
      <div className="mechanic-detail-panel">
        <Helmet>
          <title>{mechanic.name} - Mechanic in {mechanic.area} | Gears</title>
          <meta name="description" content={`Contact ${mechanic.name} in ${mechanic.area}. Specialty: ${mechanic.specialty || 'General Repairs'}. Call ${mechanic.phone}.`} />
          <script type="application/ld+json">
            {JSON.stringify(schemaMarkup)}
          </script>
        </Helmet>
      
      <div className="detail-cover">
        <div className="rating-badge-large">
          <span className="rating-score"><Star size={12} weight="fill" color="var(--lime)" /> {mechanic.rating !== 'New' ? Number(mechanic.rating).toFixed(1) : 'New'}</span>
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
        <p className="detail-area">{mechanic.area}</p>
        
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
        {activeTab === 'Overview' && (
          <div className="tab-content overview-tab">
            <h3>About</h3>
            <p><strong>Specialty:</strong> {mechanic.specialty || 'General Repairs'}</p>
            <p><strong>Phone:</strong> {mechanic.phone}</p>
            <p><strong>Status:</strong> {mechanic.open ? 'Open Now' : 'Closed'}</p>
            <div style={{ marginTop: '20px' }}>
              <button className="rate-this-btn" onClick={() => onRate(mechanic)}>
                Rate this mechanic <Star size={16}/>
              </button>
            </div>
          </div>
        )}
        
        {activeTab === 'Products' && <ItemsTab mechanicId={mechanic.id} collectionName="products" user={user} itemName="Product" />}
        {activeTab === 'Services' && <ItemsTab mechanicId={mechanic.id} collectionName="services" user={user} itemName="Service" />}
        {activeTab === 'Media' && <MediaTab mechanicId={mechanic.id} user={user} />}
        {activeTab === 'Reviews' && <ReviewsTab mechanicId={mechanic.id} />}
      </div>

      <div className="detail-bottom-bar">
        <div className="detail-bottom-left">
          <button className="icon-btn" onClick={() => onToggleSave(mechanic)}>
            <BookmarkSimple size={18} weight={savedMechanics.includes(mechanic.id) ? "fill" : "regular"} color={savedMechanics.includes(mechanic.id) ? 'var(--forest)' : 'currentColor'} />
          </button>
          <button className="icon-btn" onClick={() => onRate(mechanic)}><Star size={18} /></button>
          <button className="icon-btn"><ShareNetwork size={18} /></button>
        </div>
        <div className="detail-bottom-right">
          <a 
            className="action-btn"
            style={{ textDecoration: 'none' }}
            href={`https://www.google.com/maps/dir/?api=1&destination=${mechanic.lat && mechanic.lng ? `${mechanic.lat},${mechanic.lng}` : encodeURIComponent(`${mechanic.name} ${mechanic.area}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin size={16} /> Direction
          </a>
          <button 
            className="action-btn"
            onClick={() => window.location.href = `tel:${mechanic.phone.replace(/\s+/g, '')}`}
          >
            <Phone size={16} /> Call
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

function ReviewsTab({ mechanicId }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mechanicId) return;
    const q = query(collection(db, `mechanics/${mechanicId}/ratings`), orderBy('ratedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [mechanicId]);

  if (loading) return <div className="tab-content"><p>Loading reviews...</p></div>;

  return (
    <div className="tab-content">
      {reviews.length === 0 ? (
        <p>No reviews yet. Be the first to rate!</p>
      ) : (
        <div className="reviews-list">
          {reviews.map(rev => (
            <div key={rev.id} className="review-card">
              <div className="review-header">
                <div className="review-avatar">{rev.userName ? rev.userName.charAt(0).toUpperCase() : 'A'}</div>
                <div className="review-meta">
                  <h4 className="review-author">{rev.userName || 'Anonymous'}</h4>
                  <div className="review-date">
                    {rev.ratedAt?.toDate ? new Date(rev.ratedAt.toDate()).toLocaleDateString() : 'Recently'}
                  </div>
                </div>
                <div className="review-stars">
                  {[...Array(rev.value || 0)].map((_, i) => <Star key={`filled-${i}`} size={14} weight="fill" />)}
                  {[...Array(5 - (rev.value || 0))].map((_, i) => <Star key={`empty-${i}`} size={14} />)}
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

function ItemsTab({ mechanicId, collectionName, user, itemName }) {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mechanicId) return;
    const q = query(collection(db, `mechanics/${mechanicId}/${collectionName}`));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [mechanicId, collectionName]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
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
      {user && (
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
      
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map(item => (
          <li key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <strong>{item.name}</strong>
            {item.price && <span style={{ color: 'var(--forest)' }}>GH₵ {item.price}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MediaTab({ mechanicId, user }) {
  const [media, setMedia] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mechanicId) return;
    const q = query(collection(db, `mechanics/${mechanicId}/media`));
    const unsub = onSnapshot(q, (snap) => {
      setMedia(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [mechanicId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
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

  return (
    <div className="tab-content">
      {user && (
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
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {media.map(m => (
          <div key={m.id} style={{ width: '100%', height: '120px', borderRadius: '8px', overflow: 'hidden', background: '#eee' }}>
            <img src={m.url} alt="Mechanic Media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
          </div>
        ))}
      </div>
    </div>
  );
}
