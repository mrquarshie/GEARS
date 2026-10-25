// Maps a fuel station name to its brand logo in public/fuel-stations.
const FUEL_BRAND_LOGOS = [
  ['totalenergies', '/fuel-stations/totalenergies.png'],
  ['total', '/fuel-stations/totalenergies.png'],
  ['shell', '/fuel-stations/shell.png'],
  ['vivo energy', '/fuel-stations/shell.png'],
  ['goil', '/fuel-stations/goil.png'],
  ['allied', '/fuel-stations/allied.png'],
  ['frimps', '/fuel-stations/frimps-oil.png'],
  ['zen', '/fuel-stations/zen.png'],
  ['petrosol', '/fuel-stations/petrosol.png'],
  ['star oil', '/fuel-stations/star-oil.png'],
];

export function getFuelStationLogo(name) {
  const lower = (name || '').toLowerCase();
  const match = FUEL_BRAND_LOGOS.find(([needle]) => lower.includes(needle));
  return match ? match[1] : 'https://placehold.co/32x32';
}
