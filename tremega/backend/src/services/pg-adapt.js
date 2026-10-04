// src/services/pg-adapt.js
// Shared helpers for Supabase-backed stores whose tables may not match the
// columns this code was written against (live schema could not be probed —
// see week-4 notes). Detects PostgREST error classes and adapts inserts by
// stripping columns the live table doesn't have.

// PostgREST: PGRST205 "Could not find the table 'public.X' in the schema cache"
// Postgres:  42P01 'relation "X" does not exist'
const looksLikeMissingTable = (error) =>
  Boolean(
    error
      && (error.code === 'PGRST205'
        || error.code === '42P01'
        || (error.message
          && /could not find the table|relation .* does not exist/i.test(error.message))),
  );

// PostgREST: PGRST204 "Could not find the 'lat' column of 'checkins' in the
// schema cache" — returns the offending column name or null.
const columnFromError = (error) => {
  if (!error || !error.message) return null;
  if (error.code !== 'PGRST204' && !/column/i.test(error.message)) return null;
  const m = error.message.match(/could not find the '([^']+)' column/i);
  return m ? m[1] : null;
};

// Insert `row` into `table`, stripping unknown columns as the live schema
// rejects them (up to maxStrip). Returns:
//   { ok: true,  row, stripped: [...] }               — persisted (possibly slimmed)
//   { ok: false, error, missingTable: bool, row }     — caller decides (memory fallback)
const insertAdaptive = async (supabase, table, row, { maxStrip = 10 } = {}) => {
  const attempt = { ...row };
  const stripped = [];
  for (let i = 0; i <= maxStrip; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { error } = await supabase.from(table).insert(attempt);
    if (!error) return { ok: true, row: attempt, stripped };
    if (looksLikeMissingTable(error)) {
      return { ok: false, error, missingTable: true, row: attempt, stripped };
    }
    const col = columnFromError(error);
    if (col && Object.prototype.hasOwnProperty.call(attempt, col) && stripped.length < maxStrip) {
      delete attempt[col];
      stripped.push(col);
      // eslint-disable-next-line no-continue
      continue;
    }
    return { ok: false, error, missingTable: false, row: attempt, stripped };
  }
  return {
    ok: false,
    error: { message: `insertAdaptive: gave up after stripping ${stripped.join(', ')}` },
    missingTable: false,
    row: attempt,
    stripped,
  };
};

// UPDATE variant: apply `patch` where every filter matches, stripping
// columns the live schema rejects (same adaptation as insertAdaptive).
// filters: [{ col, val }]. selectSingle: append .select().single() and
// return the row (used by the approval CAS guard).
// Returns { ok: true, data, patch, stripped } | { ok: false, error, ... }.
const updateAdaptive = async (supabase, table, patch, filters, { maxStrip = 10, selectSingle = false } = {}) => {
  const attempt = { ...patch };
  const stripped = [];
  for (let i = 0; i <= maxStrip; i += 1) {
    let query = supabase.from(table).update(attempt);
    filters.forEach(({ col, val }) => {
      query = query.eq(col, val);
    });
    if (selectSingle) query = query.select().single();
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await query;
    if (!error) {
      if (selectSingle && !data) {
        return { ok: false, error: { message: 'no rows matched', code: 'PGRST116' }, patch: attempt, stripped, noRows: true };
      }
      return { ok: true, data: data || null, patch: attempt, stripped };
    }
    const col = columnFromError(error);
    if (col && Object.prototype.hasOwnProperty.call(attempt, col) && stripped.length < maxStrip) {
      delete attempt[col];
      stripped.push(col);
      // eslint-disable-next-line no-continue
      continue;
    }
    return { ok: false, error, patch: attempt, stripped };
  }
  return {
    ok: false,
    error: { message: `updateAdaptive: gave up after stripping ${stripped.join(', ')}` },
    patch: attempt,
    stripped,
  };
};

module.exports = { looksLikeMissingTable, columnFromError, insertAdaptive, updateAdaptive };
