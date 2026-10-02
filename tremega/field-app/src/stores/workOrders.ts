// src/stores/workOrders.ts — zustand store for the Phase 2 contractor
// workflow: assigned work orders + GPS check-ins (via /api/checkins with
// project_id = work order id).

import { create } from 'zustand';
import { api } from '../lib/api';

export type WorkOrderStatus = 'assigned' | 'in_progress' | 'completed';

export interface WorkOrder {
  id: string;
  contractor_id: string;
  title: string;
  description: string | null;
  job_address: string | null;
  status: WorkOrderStatus;
  start_time: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Checkin {
  id: string;
  project_id: string;
  worker_id: string;
  lat?: number | null;
  lng?: number | null;
  verified: boolean | null;
  verification_status: string | null;
  note?: string | null;
  created_at: string;
}

interface WorkOrdersState {
  items: WorkOrder[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  advance: (id: string, status: 'in_progress' | 'completed') => Promise<WorkOrder>;
  checkin: (id: string, lat: number, lng: number, note?: string) => Promise<any>;
  checkinsFor: (id: string) => Promise<Checkin[]>;
}

export const useWorkOrders = create<WorkOrdersState>((set, get) => ({
  items: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/api/work-orders');
      set({ items: data.work_orders || [], loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  advance: async (id, status) => {
    const { data } = await api.patch('/api/work-orders/' + id + '/status', { status });
    const updated = data.work_order as WorkOrder;
    set({ items: get().items.map((w) => (w.id === id ? { ...w, ...updated } : w)) });
    return updated;
  },

  checkin: async (id, lat, lng, note) => {
    const { data } = await api.post('/api/checkins', {
      project_id: id, lat, lng, note,
    });
    return data;
  },

  checkinsFor: async (id) => {
    const { data } = await api.get('/api/checkins', { params: { project_id: id } });
    return data.checkins || [];
  },
}));
