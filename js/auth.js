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
  const token = localStorage.getItem(TOKEN_KEY(username));
  if (!token) return null;

  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const payload = JSON.parse(jsonPayload);
    
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearToken(username);
      if (localStorage.getItem('cf_current_user') === username) {
        localStorage.removeItem('cf_current_user');
      }
      return null;
    }
  } catch (e) {
    // If parsing fails for any reason, treat as invalid/expired
    clearToken(username);
    if (localStorage.getItem('cf_current_user') === username) {
      localStorage.removeItem('cf_current_user');
    }
    return null;
  }

  return token;
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
