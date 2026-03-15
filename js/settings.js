/**
 * js/settings.js
 * 設定画面のフロントエンドロジック
 */
import { initNavbar } from './navbar.js';
import { loadToken } from './auth.js';

const PROXY_URL = 'https://chunirec-proxy.k-chunithm.workers.dev';

document.addEventListener('DOMContentLoaded', async () => {
  const username = localStorage.getItem('cf_current_user');
  const token = username ? loadToken(username) : null;

  if (!username || !token) {
    location.href = 'login.html';
    return;
  }

  initNavbar(false);
  await loadCurrentSettings(username, token);

  // 公開トグルの変更
  document.getElementById('setting-is-public')?.addEventListener('change', async (e) => {
    await updateSettings({ isPublic: e.target.checked }, token);
  });

  // メール保存
  document.getElementById('btn-save-email')?.addEventListener('click', async () => {
    const email = document.getElementById('setting-email').value;
    await updateSettings({ email }, token);
  });

  // パスワード変更
  document.getElementById('btn-change-password')?.addEventListener('click', async () => {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword     = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!currentPassword || !newPassword) {
      showStatus('現在のパスワードと新しいパスワードを入力してください', true);
      return;
    }
    if (newPassword !== confirmPassword) {
      showStatus('新しいパスワードが一致しません', true);
      return;
    }
    if (newPassword.length < 8) {
      showStatus('新しいパスワードは8文字以上にしてください', true);
      return;
    }

    const success = await updateSettings({ currentPassword, newPassword }, token);
    if (success) {
      document.getElementById('new-password').value     = '';
      document.getElementById('confirm-password').value = '';
    }
  });

  // パスワード表示切り替えの初期化
  document.querySelectorAll('.password-toggle').forEach(btn => {
    const targetId = btn.getAttribute('data-toggle');
    const input = document.getElementById(targetId);
    if (!input) return;

    btn.addEventListener('click', () => {
      const isPw = input.type === 'password';
      input.type = isPw ? 'text' : 'password';
      btn.innerHTML = isPw 
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    });
  });

  // アカウント削除
  document.getElementById('btn-delete-account-trigger')?.addEventListener('click', () => {
    const username = localStorage.getItem('cf_current_user');
    showDeleteModal(username, token);
  });
});

function showDeleteModal(username, token) {
  const modal = document.getElementById('content-modal');
  const body = document.getElementById('content-modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="text-align: center; padding: 1rem;">
      <h2 style="color: #e57373; margin-bottom: 1rem;">本当に削除しますか？</h2>
      <p style="font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.6;">
        アカウントを削除すると、これまでの計算データや設定がすべて失われます。<br>
        この操作は取り消せません。
      </p>
      <div style="background: var(--surface2); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; text-align: left;">
        <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
          確認のため、ユーザーネーム「<strong>${username}</strong>」を入力してください：
        </label>
        <input type="text" id="delete-confirm-username" class="input-field" placeholder="${username}" style="margin-bottom: 0;">
      </div>
      <div style="display: flex; gap: 1rem;">
        <button id="btn-delete-cancel" class="calc-btn" style="flex: 1; background: var(--bg-card); color: var(--text); border: 1px solid var(--border);">キャンセル</button>
        <button id="btn-delete-confirm" class="calc-btn" style="flex: 1; background: #c62828;" disabled>削除を実行</button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');

  const input = body.querySelector('#delete-confirm-username');
  const confirmBtn = body.querySelector('#btn-delete-confirm');
  const cancelBtn = body.querySelector('#btn-delete-cancel');

  input.addEventListener('input', () => {
    confirmBtn.disabled = input.value.trim().toLowerCase() !== username.toLowerCase();
  });

  cancelBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '削除中...';
    
    try {
      const res = await fetch(`${PROXY_URL}/user`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if (res.ok) {
        localStorage.removeItem('cf_current_user');
        // 他のトークンもあれば削除（auth.jsに依存する場合）
        setTimeout(() => { location.href = './?deleted=true'; }, 500);
      } else {
        const data = await res.json();
        alert('削除に失敗しました: ' + (data.error || 'Unknown error'));
        confirmBtn.disabled = false;
        confirmBtn.textContent = '削除を実行';
      }
    } catch (e) {
      console.error(e);
      alert('通信エラーが発生しました');
      confirmBtn.disabled = false;
      confirmBtn.textContent = '削除を実行';
    }
  });
}

async function loadCurrentSettings(username, token) {
  try {
    const res = await fetch(`${PROXY_URL}/user?name=${encodeURIComponent(username)}`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('データ取得失敗');
    const data = await res.json();

    const publicToggle = document.getElementById('setting-is-public');
    const emailInput   = document.getElementById('setting-email');
    const badge        = document.getElementById('email-registration-badge');
    const emailText    = document.getElementById('current-email-text');

    if (publicToggle) publicToggle.checked = data.isPublic;
    
    if (badge && emailText) {
      if (data.email) {
        badge.textContent = '登録済み';
        badge.style.background = 'rgba(76, 175, 80, 0.2)';
        badge.style.color = '#81c784';
        emailText.textContent = data.email;
        emailText.style.display = 'block';
        if (emailInput) emailInput.value = data.email;
      } else {
        badge.textContent = '未登録';
        badge.style.background = 'rgba(255, 152, 0, 0.2)';
        badge.style.color = '#ffb74d';
        emailText.style.display = 'none';
      }
    }

  } catch (e) {
    console.error(e);
    showStatus('現在の設定の読み込みに失敗しました', true);
  }
}

async function updateSettings(body, token, successMsg = '設定を更新しました') {
  try {
    const res = await fetch(`${PROXY_URL}/user/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(body)
    });

    let data;
    try {
      data = await res.json();
    } catch (e) {
      showStatus('サーバーから正しくないレスポンスが返ってきました', true);
      return false;
    }

    if (!res.ok) {
      showStatus(data.error || '更新に失敗しました', true);
      return false;
    }

    showStatus(successMsg, false);
    
    // メール更新時は表示を更新
    if (body.email !== undefined) {
      const username = localStorage.getItem('cf_current_user');
      await loadCurrentSettings(username, token);
    }

    return true;
  } catch (e) {
    console.error(e);
    showStatus('ネットワークエラーまたはCORSエラーが発生しました', true);
    return false;
  }
}

function showStatus(msg, isError) {
  const el = document.getElementById('settings-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-msg ' + (isError ? 'status-error' : 'status-success');
  el.style.display = 'block';
  
  // メッセージが見えるようにスクロール
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  if (!isError) {
    setTimeout(() => {
      el.style.display = 'none';
    }, 5000); // 成功時は5秒表示
  }
}
