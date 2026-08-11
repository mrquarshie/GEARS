// Category-specific example search phrases, cycled by the animated
// placeholder in both the home search bar and the full-screen search
// overlay — kept in one place so the two stay in sync.
export const PLACEHOLDER_SETS = {
  all: [
    'Mechanics',
    'in Accra',
    'in Kumasi',
    'Brakes',
    'Engine Repair',
    'Diagnostics',
    'Car Wash',
    'Spraying',
    'Electric Fault',
    'Oil Change',
  ],
  detailers: [
    'Detailers',
    'in Accra',
    'in Kumasi',
    'Full Detailing',
    'Interior Clean',
    'Paint Correction',
    'Ceramic Coating',
    'Polishing',
    'Engine Bay',
    'Leather Care',
  ],
  fuel: [
    'Fuel Stations',
    'in Accra',
    'in Kumasi',
    'Petrol',
    'Diesel',
    'LPG Gas',
    'Car Wash',
    'Convenience Store',
    'Toilet',
    'Air Pump',
  ],
  shop: [
    'Auto Parts',
    'in Accra',
    'in Kumasi',
    'Brake Pads',
    'Engine Oil',
    'Spark Plugs',
    'Battery',
    'Tyres',
    'Filters',
    'Bulbs',
  ],
};

export function getPlaceholderPhrases(viewMode) {
  const key = viewMode === 'detailers' ? 'detailers' : viewMode === 'fuel' ? 'fuel' : viewMode === 'shop' ? 'shop' : 'all';
  return PLACEHOLDER_SETS[key];
}
