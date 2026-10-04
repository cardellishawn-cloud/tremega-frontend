// src/tools/definitions.js
// Anthropic tool-use definitions + matching Zod schemas for all 20 agent tools.
// Each entry: { name, description, input_schema (JSON Schema for Claude), zodSchema (for server-side validation) }

const { z } = require('zod');

const uuid = z.string().uuid();
const money = z.number().min(0);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Expected ISO date (YYYY-MM-DD)');

// ---------- Bidding ----------

const analyzeBlueprints = {
  name: 'analyze_blueprints',
  description: 'Analyze uploaded blueprint/plan files for a project and extract rooms, circuits, panel locations, and scope-relevant quantities.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string', description: 'Project/bid UUID' },
      file_urls: { type: 'array', items: { type: 'string' }, description: 'URLs of blueprint files (PDF/images)' },
      focus: { type: 'string', description: 'Optional focus area, e.g. "electrical rough-in"' },
    },
    required: ['project_id', 'file_urls'],
  },
  zodSchema: z.object({
    project_id: uuid,
    file_urls: z.array(z.string().min(1)).min(1),
    focus: z.string().optional(),
  }),
};

const generateScopeDoc = {
  name: 'generate_scope_doc',
  description: 'Generate a written scope-of-work document from analyzed project data.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      scope_items: { type: 'array', items: { type: 'string' }, description: 'Scope line items to include' },
      notes: { type: 'string' },
    },
    required: ['project_id', 'scope_items'],
  },
  zodSchema: z.object({
    project_id: uuid,
    scope_items: z.array(z.string().min(1)).min(1),
    notes: z.string().optional(),
  }),
};

const estimateMaterials = {
  name: 'estimate_materials',
  description: 'Estimate material quantities and cost for a scope of work. Returns line items, total cost, and confidence.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: 'number' },
            unit: { type: 'string', description: 'e.g. "ft", "ea", "roll"' },
            unit_cost: { type: 'number' },
          },
          required: ['description', 'quantity', 'unit'],
        },
      },
    },
    required: ['project_id', 'items'],
  },
  zodSchema: z.object({
    project_id: uuid,
    items: z.array(z.object({
      description: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
      unit_cost: money.optional(),
    })).min(1),
  }),
};

const estimateLabor = {
  name: 'estimate_labor',
  description: 'Estimate labor hours and cost for a scope of work by crew role.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            role: { type: 'string', description: 'e.g. "journeyman", "apprentice"' },
            hours: { type: 'number' },
            rate: { type: 'number' },
          },
          required: ['description', 'hours'],
        },
      },
    },
    required: ['project_id', 'tasks'],
  },
  zodSchema: z.object({
    project_id: uuid,
    tasks: z.array(z.object({
      description: z.string().min(1),
      role: z.string().optional(),
      hours: z.number().positive(),
      rate: money.optional(),
    })).min(1),
  }),
};

const generateBidDoc = {
  name: 'generate_bid_doc',
  description: 'Assemble a customer-facing bid document from scope, material, and labor estimates. Always returns a draft for human review.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      scope_doc_id: { type: 'string' },
      material_estimate: { type: 'object' },
      labor_estimate: { type: 'object' },
      markup_percent: { type: 'number' },
      notes: { type: 'string' },
    },
    required: ['project_id'],
  },
  zodSchema: z.object({
    project_id: uuid,
    scope_doc_id: z.string().optional(),
    material_estimate: z.record(z.any()).optional(),
    labor_estimate: z.record(z.any()).optional(),
    markup_percent: z.number().min(0).max(100).optional(),
    notes: z.string().optional(),
  }),
};

// ---------- Scheduling ----------

const createPhase = {
  name: 'create_phase',
  description: 'Create a new project phase (e.g. rough-in, trim-out) with start/end dates.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      name: { type: 'string' },
      start_date: { type: 'string', description: 'ISO date' },
      end_date: { type: 'string', description: 'ISO date' },
      depends_on: { type: 'array', items: { type: 'string' }, description: 'Phase IDs this depends on' },
    },
    required: ['project_id', 'name', 'start_date', 'end_date'],
  },
  zodSchema: z.object({
    project_id: uuid,
    name: z.string().min(1),
    start_date: isoDate,
    end_date: isoDate,
    depends_on: z.array(z.string()).optional(),
  }),
};

const assignCrew = {
  name: 'assign_crew',
  description: 'Assign crew members to a phase. REQUIRES HUMAN APPROVAL — returns a pending approval, never executes directly.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      phase_id: { type: 'string' },
      crew_member_ids: { type: 'array', items: { type: 'string' } },
      notes: { type: 'string' },
    },
    required: ['project_id', 'phase_id', 'crew_member_ids'],
  },
  zodSchema: z.object({
    project_id: uuid,
    phase_id: z.string().min(1),
    crew_member_ids: z.array(z.string().min(1)).min(1),
    notes: z.string().optional(),
  }),
};

const checkConflicts = {
  name: 'check_conflicts',
  description: 'Check crew/phase scheduling conflicts for a given date range.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      start_date: { type: 'string' },
      end_date: { type: 'string' },
      crew_member_ids: { type: 'array', items: { type: 'string' } },
    },
    required: ['project_id', 'start_date', 'end_date'],
  },
  zodSchema: z.object({
    project_id: uuid,
    start_date: isoDate,
    end_date: isoDate,
    crew_member_ids: z.array(z.string()).optional(),
  }),
};

const alertTeam = {
  name: 'alert_team',
  description: 'Send an in-app alert/notification to project team members.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      message: { type: 'string' },
      recipient_ids: { type: 'array', items: { type: 'string' } },
      severity: { type: 'string', enum: ['info', 'warning', 'urgent'] },
    },
    required: ['project_id', 'message'],
  },
  zodSchema: z.object({
    project_id: uuid,
    message: z.string().min(1),
    recipient_ids: z.array(z.string()).optional(),
    severity: z.enum(['info', 'warning', 'urgent']).optional(),
  }),
};

// ---------- Materials ----------

const suggestMaterials = {
  name: 'suggest_materials',
  description: 'Suggest materials for a given scope item, with typical quantities and alternates.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      scope_item: { type: 'string', description: 'e.g. "200A panel upgrade"' },
      quantity: { type: 'number' },
    },
    required: ['project_id', 'scope_item'],
  },
  zodSchema: z.object({
    project_id: uuid,
    scope_item: z.string().min(1),
    quantity: z.number().positive().optional(),
  }),
};

const getSupplierPricing = {
  name: 'get_supplier_pricing',
  description: 'Look up current supplier pricing for a list of materials.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: 'number' },
            sku: { type: 'string' },
          },
          required: ['description', 'quantity'],
        },
      },
      supplier: { type: 'string', description: 'Optional preferred supplier' },
    },
    required: ['items'],
  },
  zodSchema: z.object({
    items: z.array(z.object({
      description: z.string().min(1),
      quantity: z.number().positive(),
      sku: z.string().optional(),
    })).min(1),
    supplier: z.string().optional(),
  }),
};

const orderMaterials = {
  name: 'order_materials',
  description: 'Place a materials purchase order. REQUIRES HUMAN APPROVAL — returns a pending approval, never executes directly.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            quantity: { type: 'number' },
            unit_cost: { type: 'number' },
            sku: { type: 'string' },
          },
          required: ['description', 'quantity'],
        },
      },
      supplier: { type: 'string' },
      deliver_by: { type: 'string', description: 'ISO date' },
    },
    required: ['project_id', 'items'],
  },
  zodSchema: z.object({
    project_id: uuid,
    items: z.array(z.object({
      description: z.string().min(1),
      quantity: z.number().positive(),
      unit_cost: money.optional(),
      sku: z.string().optional(),
    })).min(1),
    supplier: z.string().optional(),
    deliver_by: isoDate.optional(),
  }),
};

const trackDelivery = {
  name: 'track_delivery',
  description: 'Check delivery status for a purchase order.',
  input_schema: {
    type: 'object',
    properties: {
      purchase_order_id: { type: 'string' },
    },
    required: ['purchase_order_id'],
  },
  zodSchema: z.object({
    purchase_order_id: z.string().min(1),
  }),
};

const consolidateOrders = {
  name: 'consolidate_orders',
  description: 'Consolidate pending material orders by supplier to reduce deliveries and cost.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      order_ids: { type: 'array', items: { type: 'string' } },
    },
    required: ['project_id'],
  },
  zodSchema: z.object({
    project_id: uuid,
    order_ids: z.array(z.string()).optional(),
  }),
};

// ---------- Accountability ----------

const verifyCheckin = {
  name: 'verify_checkin',
  description: 'Verify a crew member check-in (time + location) against the scheduled job.',
  input_schema: {
    type: 'object',
    properties: {
      checkin_id: { type: 'string' },
      crew_member_id: { type: 'string' },
      project_id: { type: 'string' },
    },
    required: ['checkin_id'],
  },
  zodSchema: z.object({
    checkin_id: z.string().min(1),
    crew_member_id: z.string().optional(),
    project_id: uuid.optional(),
  }),
};

const logActivity = {
  name: 'log_activity',
  description: 'Log a job-site activity entry (work performed, hours, notes).',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      crew_member_id: { type: 'string' },
      activity: { type: 'string' },
      hours: { type: 'number' },
    },
    required: ['project_id', 'activity'],
  },
  zodSchema: z.object({
    project_id: uuid,
    crew_member_id: z.string().optional(),
    activity: z.string().min(1),
    hours: z.number().positive().optional(),
  }),
};

const geofenceCheck = {
  name: 'geofence_check',
  description: 'Check whether coordinates are inside the job-site geofence.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
    },
    required: ['project_id', 'latitude', 'longitude'],
  },
  zodSchema: z.object({
    project_id: uuid,
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
};

// ---------- Dispatch ----------

const scheduleCrew = {
  name: 'schedule_crew',
  description: 'Schedule crew to a job on specific dates. REQUIRES HUMAN APPROVAL — returns a pending approval, never executes directly.',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      crew_member_ids: { type: 'array', items: { type: 'string' } },
      date: { type: 'string', description: 'ISO date' },
      start_time: { type: 'string', description: 'e.g. "07:00"' },
      notes: { type: 'string' },
    },
    required: ['project_id', 'crew_member_ids', 'date'],
  },
  zodSchema: z.object({
    project_id: uuid,
    crew_member_ids: z.array(z.string().min(1)).min(1),
    date: isoDate,
    start_time: z.string().optional(),
    notes: z.string().optional(),
  }),
};

const notifyViaTwilio = {
  name: 'notify_via_twilio',
  description: 'Send an SMS notification to a crew member or customer via Twilio.',
  input_schema: {
    type: 'object',
    properties: {
      to_phone: { type: 'string', description: 'E.164 phone number' },
      message: { type: 'string' },
      project_id: { type: 'string' },
    },
    required: ['to_phone', 'message'],
  },
  zodSchema: z.object({
    to_phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Expected E.164 phone number'),
    message: z.string().min(1).max(1600),
    project_id: uuid.optional(),
  }),
};

const updateJobStatus = {
  name: 'update_job_status',
  description: 'Update the status of a job/project (e.g. scheduled, in_progress, on_hold, complete).',
  input_schema: {
    type: 'object',
    properties: {
      project_id: { type: 'string' },
      status: { type: 'string', enum: ['bid', 'scheduled', 'in_progress', 'on_hold', 'complete'] },
      note: { type: 'string' },
    },
    required: ['project_id', 'status'],
  },
  zodSchema: z.object({
    project_id: uuid,
    status: z.enum(['bid', 'scheduled', 'in_progress', 'on_hold', 'complete']),
    note: z.string().optional(),
  }),
};

const definitions = [
  // Bidding
  analyzeBlueprints, generateScopeDoc, estimateMaterials, estimateLabor, generateBidDoc,
  // Scheduling
  createPhase, assignCrew, checkConflicts, alertTeam,
  // Materials
  suggestMaterials, getSupplierPricing, orderMaterials, trackDelivery, consolidateOrders,
  // Accountability
  verifyCheckin, logActivity, geofenceCheck,
  // Dispatch
  scheduleCrew, notifyViaTwilio, updateJobStatus,
];

module.exports = { definitions };
