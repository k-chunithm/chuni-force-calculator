/**
 * js/auth.js
 * JWT トークンの保存・取得・削除ユーティリティ
 */

const PROXY_URL   = 'https://chunirec-proxy.k-chunithm.workers.dev';
const TOKEN_KEY   = (u) => `cf_token_${u.toLowerCase()}`;

export function saveToken(username, token) {
  localStorage.setItem(TOKEN_KEY(username), token);
}

export function loadToken(username) {
  return localStorage.getItem(TOKEN_KEY(username));
}

export function clearToken(username) {
  localStorage.removeItem(TOKEN_KEY(username));
}

export function getAuthHeaders(username) {
  const token = loadToken(username);
  return token ? { Authorization: 'Bearer ' + token } : {};
}

/**
 * ログイン API
 * @returns {{ success, token } | { error }}
 */
export async function login(username, password) {
  const res  = await fetch(`${PROXY_URL}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.token) saveToken(username, data.token);
  return { ok: res.ok, status: res.status, ...data };
}

/**
 * 新規登録 API
 * @returns {{ success, token } | { error }}
 */
export async function register(username, password) {
  const res  = await fetch(`${PROXY_URL}/auth/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.token) saveToken(username, data.token);
  return { ok: res.ok, status: res.status, ...data };
}

/**
 * パスワード再設定リクエスト
 */
export async function requestReset(email) {
  const res = await fetch(`${PROXY_URL}/auth/reset-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return { ok: res.ok, status: res.status, ...(await res.json()) };
}

/**
 * パスワード再設定実行
 */
export async function resetPassword(token, newPassword) {
  const res = await fetch(`${PROXY_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  return { ok: res.ok, status: res.status, ...(await res.json()) };
}
