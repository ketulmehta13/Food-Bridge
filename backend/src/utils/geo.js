// GeoJSON helpers for MongoDB 2dsphere queries. GeoJSON order is [lng, lat].

// Build a GeoJSON Point from latitude/longitude.
export const toPoint = (lat, lng) => ({
  type: 'Point',
  coordinates: [Number(lng), Number(lat)],
});

// Build a $near filter (the field needs a 2dsphere index). Results are sorted by distance.
export const nearQuery = (lat, lng, maxDistanceKm = 10, field = 'location') => ({
  [field]: {
    $near: {
      $geometry: toPoint(lat, lng),
      $maxDistance: maxDistanceKm * 1000, // metres
    },
  },
});
