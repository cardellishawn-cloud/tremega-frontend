// src/services/geofence-resolver.js
// Resolve the job-site geofence for a project: { lat, lng, radius_m, source }.
//
// Lookup order: phases -> bids -> projects. The live schema could not be
// probed at build time (invalid API key in .env), so rows are read with
// select('*') and coordinates are extracted from whichever columns actually
// exist (candidate lists below). Any table/column error is tolerated and
// resolution moves on to the next source. Returns null when no geofence is
// configured — callers treat that as "unverified_no_geofence", not an error.

const { looksLikeMissingTable } = require('./pg-adapt');
const { validateCoords } = require('./geo');

let supabaseClient = null;
let supabaseLoadAttempted = false;

const setSupabase = (client) => {
  supabaseClient = client;
  supabaseLoadAttempted = true;
};

const getSupabase = () => {
  if (!supabaseLoadAttempted) {
    supabaseLoadAttempted = true;
    try {
      // eslint-disable-next-line global-require
      supabaseClient = require('../../lib/supabase');
    } catch (err) {
      supabaseClient = null;
    }
  }
  return supabaseClient;
};

const LAT_CANDIDATES = ['site_lat', 'latitude', 'lat', 'site_latitude', 'geofence_lat'];
const LNG_CANDIDATES = ['site_lng', 'longitude', 'lng', 'lon', 'long', 'site_longitude', 'geofence_lng'];
const RADIUS_CANDIDATES = ['site_radius_m', 'radius_m', 'geofence_radius_m', 'geofence_radius', 'radius'];

const pick = (row, candidates) => {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      const n = Number(row[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
};

// Extract a geofence from an arbitrary row, or null when it has no usable
// coordinates. A radius is required — coordinates without a configured
// radius do not count as a geofence (no invented defaults).
const extractGeofence = (row, source) => {
  if (!row || typeof row !== 'object') return null;
  const lat = pick(row, LAT_CANDIDATES);
  const lng = pick(row, LNG_CANDIDATES);
  const coords = validateCoords(lat, lng);
  const radiusM = pick(row, RADIUS_CANDIDATES);
  if (!coords || !Number.isFinite(radiusM) || radiusM <= 0) return null;
  return { lat: coords.lat, lng: coords.lng, radius_m: radiusM, source };
};

// Query one table for candidate rows. filterCol lets each source key off the
// column it actually uses (phases.project_id vs bids.id, etc.). Returns []
// on any error (missing table/column included).
const selectRows = async (table, filters) => {
  try {
    let query = getSupabase().from(table).select('*');
    filters.forEach(({ col, val }) => {
      query = query.eq(col, val);
    });
    const { data, error } = await query.limit(25);
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
};

// Resolve the geofence for a project. Never throws; returns null when no
// source yields a usable geofence (or Supabase is unavailable).
const resolveGeofence = async (projectId) => {
  if (!projectId || !getSupabase()) return null;

  // 1. phases: a phase may carry the site coords/radius for the project.
  const phaseRows = await selectRows('phases', [{ col: 'project_id', val: projectId }]);
  for (const row of phaseRows) {
    const fence = extractGeofence(row, 'phases');
    if (fence) return fence;
  }

  // 2. bids: in this app the project id is usually the bid id; try both keys.
  const bidRows = await selectRows('bids', [{ col: 'id', val: projectId }]);
  const bidRowsAlt = bidRows.length
    ? bidRows
    : await selectRows('bids', [{ col: 'project_id', val: projectId }]);
  for (const row of bidRowsAlt) {
    const fence = extractGeofence(row, 'bids');
    if (fence) return fence;
  }

  // 3. projects table, when present.
  const projectRows = await selectRows('projects', [{ col: 'id', val: projectId }]);
  for (const row of projectRows) {
    const fence = extractGeofence(row, 'projects');
    if (fence) return fence;
  }

  return null;
};

// Look up a worker's phone number from the users table, tolerating the phone
// column being absent or named differently. Returns E.164-ish string or null.
const PHONE_CANDIDATES = ['phone', 'phone_number', 'phone_e164', 'mobile', 'sms_number'];

const lookupUserPhone = async (userId) => {
  if (!userId || !getSupabase()) return null;
  try {
    const { data, error } = await getSupabase()
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    for (const key of PHONE_CANDIDATES) {
      if (typeof data[key] === 'string' && data[key].trim()) return data[key].trim();
    }
    return null;
  } catch (err) {
    return null;
  }
};

module.exports = {
  resolveGeofence,
  lookupUserPhone,
  extractGeofence, // exported for tests
  setSupabase,
  // re-exported so callers can detect backend state if needed
  looksLikeMissingTable,
};
