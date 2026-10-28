/**
 * Major cities and towns of Pakistan for offline map labels.
 * rank 1: largest cities (always labelled), 2: regional, 3: shown when zoomed in.
 */
export interface City {
  name: string;
  lat: number;
  lng: number;
  rank: 1 | 2 | 3;
}

export const CITIES: City[] = [
  { name: 'Karachi', lat: 24.8607, lng: 67.0011, rank: 1 },
  { name: 'Lahore', lat: 31.5204, lng: 74.3587, rank: 1 },
  { name: 'Islamabad', lat: 33.6844, lng: 73.0479, rank: 1 },
  { name: 'Faisalabad', lat: 31.4504, lng: 73.135, rank: 1 },
  { name: 'Peshawar', lat: 34.0151, lng: 71.5249, rank: 1 },
  { name: 'Quetta', lat: 30.1798, lng: 66.975, rank: 1 },
  { name: 'Multan', lat: 30.1575, lng: 71.5249, rank: 1 },
  { name: 'Rawalpindi', lat: 33.5651, lng: 73.0169, rank: 2 },
  { name: 'Hyderabad', lat: 25.396, lng: 68.3578, rank: 2 },
  { name: 'Gujranwala', lat: 32.1877, lng: 74.1945, rank: 2 },
  { name: 'Sialkot', lat: 32.4945, lng: 74.5229, rank: 2 },
  { name: 'Bahawalpur', lat: 29.3956, lng: 71.6836, rank: 2 },
  { name: 'Sargodha', lat: 32.074, lng: 72.6861, rank: 2 },
  { name: 'Sukkur', lat: 27.7052, lng: 68.8574, rank: 2 },
  { name: 'Larkana', lat: 27.557, lng: 68.2264, rank: 2 },
  { name: 'Gwadar', lat: 25.1264, lng: 62.3225, rank: 2 },
  { name: 'Gilgit', lat: 35.9208, lng: 74.308, rank: 2 },
  { name: 'Muzaffarabad', lat: 34.37, lng: 73.4711, rank: 2 },
  { name: 'Dera Ismail Khan', lat: 31.8314, lng: 70.9019, rank: 2 },
  { name: 'Rahim Yar Khan', lat: 28.4202, lng: 70.2952, rank: 2 },
  { name: 'Abbottabad', lat: 34.1688, lng: 73.2215, rank: 2 },
  { name: 'Mardan', lat: 34.1986, lng: 72.0404, rank: 2 },
  { name: 'Turbat', lat: 26.0023, lng: 63.044, rank: 2 },
  { name: 'Skardu', lat: 35.2971, lng: 75.6333, rank: 2 },
  { name: 'Sheikhupura', lat: 31.7167, lng: 73.985, rank: 3 },
  { name: 'Jhang', lat: 31.2681, lng: 72.3181, rank: 3 },
  { name: 'Dera Ghazi Khan', lat: 30.0459, lng: 70.6403, rank: 3 },
  { name: 'Gujrat', lat: 32.5731, lng: 74.0789, rank: 3 },
  { name: 'Sahiwal', lat: 30.6682, lng: 73.1114, rank: 3 },
  { name: 'Wah Cantt', lat: 33.7715, lng: 72.751, rank: 3 },
  { name: 'Kasur', lat: 31.1187, lng: 74.4467, rank: 3 },
  { name: 'Okara', lat: 30.8138, lng: 73.4534, rank: 3 },
  { name: 'Mingora', lat: 34.7717, lng: 72.36, rank: 3 },
  { name: 'Nawabshah', lat: 26.2442, lng: 68.41, rank: 3 },
  { name: 'Chiniot', lat: 31.72, lng: 72.9789, rank: 3 },
  { name: 'Kotri', lat: 25.3656, lng: 68.3083, rank: 3 },
  { name: 'Hafizabad', lat: 32.0709, lng: 73.688, rank: 3 },
  { name: 'Sadiqabad', lat: 28.3091, lng: 70.13, rank: 3 },
  { name: 'Mirpur Khas', lat: 25.5276, lng: 69.0111, rank: 3 },
  { name: 'Burewala', lat: 30.1667, lng: 72.65, rank: 3 },
  { name: 'Kohat', lat: 33.5869, lng: 71.4429, rank: 3 },
  { name: 'Khanewal', lat: 30.3017, lng: 71.9321, rank: 3 },
  { name: 'Muzaffargarh', lat: 30.0703, lng: 71.1933, rank: 3 },
  { name: 'Mandi Bahauddin', lat: 32.5861, lng: 73.4917, rank: 3 },
  { name: 'Jacobabad', lat: 28.2769, lng: 68.4514, rank: 3 },
  { name: 'Jhelum', lat: 32.9425, lng: 73.7257, rank: 3 },
  { name: 'Chitral', lat: 35.8518, lng: 71.7864, rank: 3 },
  { name: 'Hub', lat: 25.05, lng: 66.8833, rank: 3 },
  { name: 'Khuzdar', lat: 27.8, lng: 66.6167, rank: 3 },
  { name: 'Zhob', lat: 31.3417, lng: 69.4486, rank: 3 },
  { name: 'Thatta', lat: 24.7461, lng: 67.9236, rank: 3 },
  { name: 'Badin', lat: 24.656, lng: 68.837, rank: 3 },
  { name: 'Attock', lat: 33.766, lng: 72.3609, rank: 3 },
  { name: 'Bannu', lat: 32.9889, lng: 70.6056, rank: 3 },
  { name: 'Murree', lat: 33.907, lng: 73.3943, rank: 3 },
];

/** Nearest listed city and its great-circle distance in km. */
export function nearestCity(lat: number, lng: number): { city: City; km: number } {
  let best = CITIES[0];
  let bestKm = Infinity;
  for (const c of CITIES) {
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (km < bestKm) {
      best = c;
      bestKm = km;
    }
  }
  return { city: best, km: bestKm };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
