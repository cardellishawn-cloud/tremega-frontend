// src/lib/api.ts — axios client for the Tremega backend.
// JWT comes from SecureStore on every request. On a physical device,
// localhost is the phone itself — so we derive the dev machine's IP from
// the Expo dev server (hostUri). Set app.json extra.apiUrl to override
// (e.g. the deployed backend URL for TestFlight builds).

import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'tremega_jwt';

const deriveBaseUrl = (): string => {
  // Explicit API URL in app.json
  const explicit = Constants.expoConfig?.extra?.apiUrl;
  if (explicit && typeof explicit === 'string') {
    console.log('Using explicit API URL from app.json:', explicit);
    return explicit;
  }

  // Fallback to dev machine's IP from Expo hostUri
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri && typeof hostUri === 'string') {
    const host = hostUri.split(':')[0];
    const url = `http://${host}:3000`;
    console.log('Derived API URL from Expo hostUri:', url);
    return url;
  }

  // Final fallback
  const fallback = 'http://10.0.0.181:3000';
  console.log('Using hardcoded fallback API URL:', fallback);
  return fallback;
};

const baseUrl = deriveBaseUrl();
console.log('API Base URL:', baseUrl);
export const api = axios.create({ baseURL: baseUrl, timeout: 30000 });

api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (err) { /* no token — request goes unauthenticated */ }
  return config;
});

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
