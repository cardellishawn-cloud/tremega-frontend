// src/stores/auth.ts — zustand auth store.
// OTP login (field) + email/password login (GC, next week) share this store.

import { create } from 'zustand';
import { api, tokenStore } from '../lib/api';

export type Role = 'admin' | 'contractor' | 'sub' | 'client';

export interface User {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  phone?: string;
  company_name?: string | null;
}

interface AuthState {
  user: User | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  sendCode: (phone: string) => Promise<{ sent: boolean; reason?: string; message?: string }>;
  verifyCode: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const roleHome = (role?: Role): string =>
  (role === 'admin' || role === 'contractor') ? '/(gc)' : '/(field)';

// Accept any common US phone format and produce E.164: strip non-digits,
// add the country code when missing. '865-337-9299' -> '+18653379299'.
const normalizePhone = (raw: string): string => {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  return `+${d}`;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const token = await tokenStore.get();
      if (!token) {
        set({ hydrated: true });
        return;
      }
      const { data } = await api.get('/api/auth/me');
      set({ user: data, hydrated: true });
    } catch (err) {
      await tokenStore.clear();
      set({ user: null, hydrated: true });
    }
  },

  sendCode: async (phone) => {
    const { data } = await api.post('/api/auth/otp/send', { phone: normalizePhone(phone) });
    return data;
  },

  verifyCode: async (phone, code) => {
    const { data } = await api.post('/api/auth/otp/verify', { phone: normalizePhone(phone), code });
    await tokenStore.set(data.token);
    set({ user: data.user });
  },

  logout: async () => {
    await tokenStore.clear();
    set({ user: null });
  },
}));
