// src/services/approval-service.js
// Atomic approval transitions — the single guard every approval surface uses
// (/api/agent/approvals and /api/orders). One approval can be decided exactly
// once, under any concurrency:
//
//   PostgREST note: there are no multi-statement transactions / SELECT ... FOR
//   UPDATE through the REST API, so the atomic primitive is a single-statement
//   compare-and-set UPDATE ... WHERE id AND status='pending' (atomic in
//   Postgres itself). The memory store does the same check+set synchronously
//   (atomic in Node's event loop). See approval-store.transition().
//
// Flow: load → fast-path 409 → CAS claim pending→approved/rejected → apply
// the resource side effect (order submit/reject, bid won/rejected, or the
// tool's approved executor) → record the result. A lost CAS or an
// already-decided resource is a 409; the side effect runs at most once.

const approvalStore = require('./approval-store');
const ordersService = require('./orders-service');
const bidsStore = require('./bids-store');
const registry = require('../tools/registry');

const httpError = (status, code, message) => ({
  error: { code, message },
  http_status: status,
  timestamp: new Date().toISOString(),
});

// What does deciding this approval act upon? Checks the 009+ `input`
// payload first, then the legacy live columns (resource_type/resource_id).
const resolveResource = (approval) => {
  const input = approval.input || {};
  if (input.order_id) return { type: 'order', id: input.order_id };
  if (input.bid_id) return { type: 'bid', id: input.bid_id };
  if (approval.resource_type === 'order' && approval.resource_id) {
    return { type: 'order', id: approval.resource_id };
  }
  if (approval.resource_type === 'bid' && approval.resource_id) {
    return { type: 'bid', id: approval.resource_id };
  }
  return { type: 'tool', id: null };
};

const approveApprovalAtomic = async (approvalId, userId) => {
  const approval = await approvalStore.get(approvalId);
  if (!approval) return httpError(404, 'APPROVAL_NOT_FOUND', `Approval ${approvalId} not found`);
  if (approval.status !== 'pending') {
    return httpError(409, 'ALREADY_DECIDED', `Approval is already ${approval.status}`);
  }

  const decidedAt = new Date().toISOString();
  // Dual-write decision fields: 009+ (decided_*) and legacy live
  // (approved_*) columns — updateAdaptive strips whichever half is absent.
  const claimed = await approvalStore.transition(approvalId, 'pending', {
    status: 'approved',
    decided_by: userId,
    decided_at: decidedAt,
    approved_by: userId,
    approved_at: decidedAt,
  });
  if (!claimed) return httpError(409, 'ALREADY_DECIDED', 'Approval is already decided');

  const resource = resolveResource(approval);
  let result;
  try {
    if (resource.type === 'order') {
      const submitted = await ordersService.submitOrder(resource.id, userId);
      result = submitted.error ? submitted : { status: 'executed', ...submitted };
    } else if (resource.type === 'bid') {
      const won = await bidsStore.markWon(resource.id, userId);
      result = won.error ? won : { status: 'executed', bid_id: resource.id, bid_status: 'won' };
    } else {
      // Generic gated tool (order_materials legacy, assign_crew, schedule_crew…)
      result = await registry.executeApproved(approval.tool_name || approval.action_type, approval.input, {
        approval_id: approvalId,
        user_id: userId,
        project_id: approval.project_id,
      });
    }
  } catch (err) {
    // Roll the claim back so the approval can be retried.
    await approvalStore.transition(approvalId, 'approved', {
      status: 'pending', decided_by: null, decided_at: null,
    });
    return httpError(500, 'EXECUTION_ERROR', `Approved action failed: ${err.message}`);
  }

  if (result && result.error && result.error.code === 'VALIDATION_ERROR') {
    // Stored input no longer validates — the approval stays pending so it
    // remains actionable (week-3 semantics), surfaced as 422.
    await approvalStore.transition(approvalId, 'approved', {
      status: 'pending', decided_by: null, decided_at: null,
    });
    return httpError(422, result.error.code, result.error.message);
  }

  if (result && result.error && (result.error.code === 'INVALID_STATE' || result.error.code === 'ORDER_NOT_FOUND' || result.error.code === 'BID_NOT_FOUND')) {
    // Resource already decided elsewhere — release the claim and report 409.
    await approvalStore.transition(approvalId, 'approved', {
      status: 'pending', decided_by: null, decided_at: null,
    });
    return httpError(409, result.error.code, result.error.message);
  }

  await approvalStore.update(approvalId, { result });
  return {
    approval: { ...claimed, result },
    result,
    resource_type: resource.type,
    resource_id: resource.id,
    http_status: 200,
  };
};

const rejectApprovalAtomic = async (approvalId, userId, reason) => {
  const approval = await approvalStore.get(approvalId);
  if (!approval) return httpError(404, 'APPROVAL_NOT_FOUND', `Approval ${approvalId} not found`);
  if (approval.status !== 'pending') {
    return httpError(409, 'ALREADY_DECIDED', `Approval is already ${approval.status}`);
  }

  const decidedAt = new Date().toISOString();
  const claimed = await approvalStore.transition(approvalId, 'pending', {
    status: 'rejected',
    decided_by: userId,
    decided_at: decidedAt,
    reason: reason || null,
    rejected_by: userId,
    rejected_at: decidedAt,
    rejection_reason: reason || null,
  });
  if (!claimed) return httpError(409, 'ALREADY_DECIDED', 'Approval is already decided');

  const resource = resolveResource(approval);
  if (resource.type === 'order') {
    const rejected = await ordersService.rejectOrder(resource.id, reason || 'rejected', userId);
    if (rejected.error && rejected.error.code === 'INVALID_STATE') {
      await approvalStore.transition(approvalId, 'rejected', {
        status: 'pending', decided_by: null, decided_at: null, reason: null,
      });
      return httpError(409, rejected.error.code, rejected.error.message);
    }
  } else if (resource.type === 'bid') {
    const rejected = await bidsStore.markRejected(resource.id, reason || null, userId);
    if (rejected.error && rejected.error.code === 'INVALID_STATE') {
      await approvalStore.transition(approvalId, 'rejected', {
        status: 'pending', decided_by: null, decided_at: null, reason: null,
      });
      return httpError(409, rejected.error.code, rejected.error.message);
    }
  }
  // 'tool' rejections decide the approval only — the action simply never runs.

  return {
    approval: claimed,
    result: { status: 'rejected', reason: reason || null },
    resource_type: resource.type,
    resource_id: resource.id,
    http_status: 200,
  };
};

module.exports = { approveApprovalAtomic, rejectApprovalAtomic, resolveResource };
