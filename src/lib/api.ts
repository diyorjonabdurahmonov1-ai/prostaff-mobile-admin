/**
 * Typed fetch client for the PROSTAFF admin panel.
 *
 * The access token the backend issues lives for 15 minutes, so a panel that
 * only stored that token dropped the operator back to the login screen a
 * quarter of an hour into their shift. Both tokens are kept here instead:
 *
 * - On a 401 the client spends the refresh token, retries the original request
 *   with the new access token, and the caller never sees the interruption.
 * - Concurrent 401s share a single refresh — a dashboard that fires six
 *   requests at once must not burn six refresh tokens.
 * - The backend rotates the refresh token on every use, so the replacement is
 *   persisted immediately; losing it would end the session at the next refresh.
 * - When the refresh itself fails the tokens are cleared and `onRefreshFailed`
 *   lets the auth store show the login screen.
 */

import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://api.prostaff.uz/api/v1';
// const API_URL = 'https://parliamentary-uri-watts-distance.trycloudflare.com/api/v1';

const ACCESS_KEY = 'auth_token';
const REFRESH_KEY = 'refresh_token';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

// ---- Token state ------------------------------------------------------------

let accessToken: string | null = null;
let refreshToken: string | null = null;

/** Restores both tokens from secure storage. Returns the access token. */
export async function loadTokens(): Promise<string | null> {
  if (accessToken) return accessToken;
  try {
    const [access, refresh] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    accessToken = access;
    refreshToken = refresh;
  } catch {
    accessToken = null;
    refreshToken = null;
  }
  return accessToken;
}

/** Persists a freshly issued pair. */
export async function setTokens(access: string, refresh: string): Promise<void> {
  accessToken = access;
  refreshToken = refresh;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, access),
    SecureStore.setItemAsync(REFRESH_KEY, refresh),
  ]);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {}),
  ]);
}

export function getAuthToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

/** Called when the refresh token is gone or rejected — the session is over. */
let onRefreshFailed: (() => void) | null = null;
export function setOnRefreshFailed(cb: (() => void) | null): void {
  onRefreshFailed = cb;
}

// ---- Refresh ----------------------------------------------------------------

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  // Whoever gets here first does the work; everyone else awaits the same call.
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { token: string; refresh_token: string };
      if (!data.token || !data.refresh_token) return false;
      await setTokens(data.token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// ---- Request plumbing -------------------------------------------------------

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retrying = false
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(
      'network_error',
      err instanceof Error ? err.message : 'Tarmoqqa ulanib bo‘lmadi',
      0
    );
  }

  // The access token has expired — swap it and replay the request once.
  if (res.status === 401 && !retrying && accessToken) {
    if (await tryRefresh()) {
      return request<T>(method, path, body, true);
    }
    await clearTokens();
    onRefreshFailed?.();
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown;
  if (text.length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const envelope = data as { error?: { code?: string; message?: string } } | undefined;
    throw new ApiError(
      envelope?.error?.code ?? `http_${res.status}`,
      envelope?.error?.message ?? `So‘rov bajarilmadi (${res.status})`,
      res.status
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
