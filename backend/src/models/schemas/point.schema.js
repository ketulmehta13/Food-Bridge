import mongoose from 'mongoose';

/**
 * Reusable GeoJSON Point sub-schema. Coordinates are [longitude, latitude];
 * build values with toPoint(lat, lng) from utils/geo.js.
 * The parent schema must add a 2dsphere index on the field.
 */
export const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (coords) =>
          Array.isArray(coords) &&
          coords.length === 2 &&
          coords[0] >= -180 &&
          coords[0] <= 180 &&
          coords[1] >= -90 &&
          coords[1] <= 90,
        message: 'Coordinates must be [longitude, latitude]',
      },
    },
  },
  { _id: false }
);
