// src/services/bids-store.js
// Bid persistence for the bidding workflow: create (draft) → markWon on
// approval. The live bids table predates this code and could not be probed
// (invalid API key), so writes use insertAdaptive (strips unknown columns)
// and reads fall back to the in-memory shadow store on any Supabase miss.
// Audit events go through orders-service.writeAudit so the whole workflow's
// trail lands in one audit_events stream.

const { v4: uuidv4 } = require('uuid');
const { insertAdaptive, looksLikeMissingTable } = require('./pg-adapt');
const ordersService = require('./orders-service');

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

const memoryBids = new Map();

const createBid = async ({
  project_id,
  title = null,
  scope_doc_id = null,
  markup_percent = null,
  materials_cost = null,
  labor_cost = null,
  contingency_amount = null,
  total = null,
  scope = null,
  created_by = null,
}) => {
  const now = new Date().toISOString();
  const bid = {
    id: uuidv4(),
    project_id,
    title,
    scope_doc_id,
    status: 'draft',
    markup_percent,
    materials_cost,
    labor_cost,
    contingency_amount,
    total,
    scope,
    created_by,
    created_at: now,
    updated_at: now,
    won_at: null,
  };
  let persisted = false;
  if (getSupabase()) {
    try {
      const result = await insertAdaptive(getSupabase(), 'bids', bid);
      persisted = result.ok;
      if (!result.ok && !result.missingTable) {
        console.warn(`bids-store: supabase insert failed (${result.error && result.error.message}); using memory`);
      }
    } catch (err) {
      console.warn(`bids-store: supabase insert threw (${err.message}); using memory`);
    }
  }
  memoryBids.set(bid.id, bid); // shadow store always tracks the row
  await ordersService.writeAudit({
    action: 'bid_created',
    actor_id: created_by,
    entity: 'bid',
    entity_id: bid.id,
    detail: { project_id, markup_percent, total, persisted },
  });
  return { bid, persisted };
};

const getBid = async (bidId) => {
  if (getSupabase()) {
    try {
      const { data, error } = await getSupabase().from('bids').select('*').eq('id', bidId).single();
      if (!error && data) return data;
      if (error && !looksLikeMissingTable(error)) {
        // Row genuinely absent in Supabase — memory shadow may still have it.
      }
    } catch (err) {
      // fall through to memory
    }
  }
  return memoryBids.get(bidId) || null;
};

// draft → won (terminal for the bidding flow). Returns updated bid or error.
const markWon = async (bidId, actorId = null) => {
  const bid = await getBid(bidId);
  if (!bid) return { error: { code: 'BID_NOT_FOUND', message: `Bid ${bidId} not found` } };
  if (bid.status === 'won') return { bid, alreadyWon: true };
  const now = new Date().toISOString();
  const patch = { status: 'won', won_at: now, updated_at: now };
  if (getSupabase()) {
    try {
      await getSupabase().from('bids').update({ status: 'won', updated_at: now }).eq('id', bidId);
    } catch (err) {
      // tolerate — memory shadow is authoritative during migration
    }
  }
  const updated = { ...bid, ...patch };
  memoryBids.set(bidId, updated);
  await ordersService.writeAudit({
    action: 'bid_won',
    actor_id: actorId,
    entity: 'bid',
    entity_id: bidId,
    detail: { project_id: bid.project_id },
  });
  return { bid: updated, alreadyWon: false };
};

// draft → rejected (terminal). Reason recorded.
const markRejected = async (bidId, reason = null, actorId = null) => {
  const bid = await getBid(bidId);
  if (!bid) return { error: { code: 'BID_NOT_FOUND', message: `Bid ${bidId} not found` } };
  if (bid.status !== 'draft') {
    return { error: { code: 'INVALID_STATE', message: `Bid is already ${bid.status}` } };
  }
  const now = new Date().toISOString();
  const patch = { status: 'rejected', reason, updated_at: now };
  if (getSupabase()) {
    try {
      await getSupabase().from('bids').update({ status: 'rejected', updated_at: now }).eq('id', bidId);
    } catch (err) {
      // tolerate — memory shadow is authoritative during migration
    }
  }
  const updated = { ...bid, ...patch };
  memoryBids.set(bidId, updated);
  await ordersService.writeAudit({
    action: 'bid_rejected',
    actor_id: actorId,
    entity: 'bid',
    entity_id: bidId,
    detail: { project_id: bid.project_id, reason },
  });
  return { bid: updated };
};

const _clearMemory = () => memoryBids.clear();

module.exports = { createBid, getBid, markWon, markRejected, setSupabase, _clearMemory };
