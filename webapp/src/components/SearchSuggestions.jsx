import React from 'react';
import { LocationIcon, FillingStationIcon, CarDetailingIcon, ShopIcon, MechanicIcon } from './icons';

// Shared by the mobile full-screen search overlay (SearchPanel) and the
// desktop inline dropdown (MechanicListPanel) so both surfaces match a
// suggestion the same way and render it identically.
export function buildMechanicsByName(mechanics) {
  return new Map(mechanics.map(m => [m.name, m]));
}

export function buildSuggestionMatches(mechanics, searchTerm, { limit = 8 } = {}) {
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
    (m.products || []).forEach(p => {
      const prodName = typeof p === 'string' ? p : p.name;
      if (prodName?.toLowerCase().includes(term)) uniqueMatches.set(prodName, { type: 'Product', value: prodName });
    });
    (m.fuelPrices || []).forEach(f => { if (f.type?.toLowerCase().includes(term)) uniqueMatches.set(f.type, { type: 'Fuel', value: f.type }); });
    (m.facilities || []).forEach(f => { if (f.toLowerCase?.().includes(term)) uniqueMatches.set(f, { type: 'Facility', value: f }); });
    if (m.phone?.toLowerCase().includes(term)) uniqueMatches.set(m.phone, { type: 'Phone', value: m.phone });
  });
  return Array.from(uniqueMatches.values()).slice(0, limit);
}

// Small icon per suggestion, matching what the row is actually pointing to.
export function SuggestionRowIcon({ row, mechanicsByName }) {
  if (row.type === 'Area' || row.type === 'Location') {
    return <LocationIcon size={20} state="filled" />;
  }
  if (row.type === 'Fuel') {
    return <FillingStationIcon size={20} state="filled" />;
  }
  if (row.type === 'Name') {
    const specialty = mechanicsByName.get(row.value)?.specialty;
    if (specialty === 'Fuel Station') return <FillingStationIcon size={20} state="filled" />;
    if (specialty === 'Car Detailing') return <CarDetailingIcon size={20} state="filled" />;
    if (['Shop', 'Parts Shop', 'Auto Parts', 'Car Parts'].includes(specialty)) return <ShopIcon size={20} state="filled" />;
  }
  return <MechanicIcon size={20} state="filled" />;
}
