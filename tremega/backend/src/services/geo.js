// src/services/geo.js
// Pure geospatial helpers — no I/O, no env, fully unit-testable.
// Used by routes/checkins.js and the geofence_check / verify_checkin agent tools.

const EARTH_RADIUS_M = 6371000; // mean Earth radius, meters

// Accuracy above this (meters) downgrades confidence to 'low'.
const LOW_ACCURACY_THRESHOLD_M = 100;

const toRadians = (deg) => (deg * Math.PI) / 180;

// Great-circle distance between two points, in meters.
const haversineM = (lat1, lng1, lat2, lng2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
};

// Normalize a coordinate pair. Accepts numbers and numeric strings; rejects
// null/undefined/booleans, non-finite values, and out-of-range values.
// Returns { lat, lng } or null.
const validateCoords = (lat, lng) => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  if (typeof lat === 'boolean' || typeof lng === 'boolean') return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  if (Math.abs(nLat) > 90 || Math.abs(nLng) > 180) return null;
  return { lat: nLat, lng: nLng };
};

const invalidCoords = () => ({
  inside: false,
  error: { code: 'INVALID_COORDS', message: 'Missing or out-of-range coordinates' },
});

// Normalize the accuracy hint: only finite, positive values count.
const normalizeAccuracy = (accuracyM) => {
  const n = Number(accuracyM);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
};

// Check a point against a circular geofence.
//   point:  { lat, lng }
//   fence:  { lat, lng, radius_m }
//   accuracyM: optional GPS accuracy radius of the reading, in meters
//
// Rules:
//   - invalid coords/fence          -> { inside: false, error: { code: 'INVALID_COORDS' } }
//   - distance > radius + accuracy  -> outside
//   - distance <= radius            -> inside; 'boundary' (low confidence) when the
//                                      uncertainty circle touches/crosses the fence edge
//   - radius < distance <= radius + accuracy -> inside via the accuracy band: 'boundary',
//                                      low confidence
//   - accuracy > 100 m              -> confidence 'low' + 'accuracy_exceeds_100m' reason
// Never throws.
const geofenceCheck = (point, fence, accuracyM) => {
  try {
    const p = point && validateCoords(point.lat, point.lng);
    const f = fence && validateCoords(fence.lat, fence.lng);
    const radiusM = fence ? Number(fence.radius_m) : NaN;
    if (!p || !f || !Number.isFinite(radiusM) || radiusM <= 0) {
      return invalidCoords();
    }

    const accuracy = normalizeAccuracy(accuracyM);
    const distance = haversineM(p.lat, p.lng, f.lat, f.lng);
    const distanceM = Math.round(distance * 10) / 10;

    const reasons = [];
    if (accuracy > LOW_ACCURACY_THRESHOLD_M) {
      reasons.push('accuracy_exceeds_100m');
    }
    // The edge of the fence is within the reading's uncertainty (or the point
    // sits exactly on it) — location could plausibly be on either side.
    const boundary = distance + accuracy >= radiusM;

    let inside;
    if (distance <= radiusM) {
      inside = true;
    } else if (distance <= radiusM + accuracy) {
      inside = true; // only inside thanks to the accuracy band
    } else {
      inside = false;
    }

    if (inside && boundary) reasons.push('boundary');

    const confidence =
      accuracy > LOW_ACCURACY_THRESHOLD_M || (inside && boundary) ? 'low' : 'high';

    return {
      inside,
      distance_m: distanceM,
      radius_m: radiusM,
      confidence,
      reasons,
    };
  } catch (err) {
    // Defensive: this function must never throw into request handlers.
    return invalidCoords();
  }
};

module.exports = {
  haversineM,
  geofenceCheck,
  validateCoords,
  LOW_ACCURACY_THRESHOLD_M,
};
