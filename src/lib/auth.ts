const API_URL = 'http://localhost:3000';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  company_logo_url: string | null;
  subscription_tier: string;
  subscription_status: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: AuthUser | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_in: number | null;
  error?: string;
}

export async function signUp(email: string, password: string, fullName: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/sign-up`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, full_name: fullName }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Sign up failed');
  }

  if (data.access_token) {
    localStorage.setItem('tremega_token', data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('tremega_refresh_token', data.refresh_token);
    }
  }

  return data;
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Sign in failed');
  }

  if (data.access_token) {
    localStorage.setItem('tremega_token', data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('tremega_refresh_token', data.refresh_token);
    }
  }

  return data;
}

export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
    } catch {
      // Ignore errors — we're logging out anyway
    }
  }
  localStorage.removeItem('tremega_token');
  localStorage.removeItem('tremega_refresh_token');
}

export function getToken(): string | null {
  return localStorage.getItem('tremega_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export async function getCurrentUser(): Promise<AuthUser> {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(`${API_URL}/api/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('tremega_token');
      localStorage.removeItem('tremega_refresh_token');
      throw new Error('Session expired. Please sign in again.');
    }
    throw new Error('Failed to fetch user');
  }

  return res.json();
}
