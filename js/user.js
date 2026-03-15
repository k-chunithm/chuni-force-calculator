/**
 * js/user.js
 * ユーザーページ（/user/#username）のロジック（JWT認証付き）
 */

import { getClassInfo, getRankInfo } from './calc.js';
import { escHtml, truncate          } from './render.js';
import { loadToken, clearToken       } from './auth.js';
import { initNavbar } from './navbar.js';

const PROXY_URL = 'https://chunirec-proxy.k-chunithm.workers.dev';

// ──────────────────────────────────────────────────────────
//  エントリーポイント
// ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar(true);

  const username = (location.hash.slice(1) || '').trim().toLowerCase();
  if (!username) {
    showError('ユーザー名が指定されていません。<br>URL の # の後にユーザー名を指定してください（例: /user/#k_chunithm）');
    hideLoading();
    return;
  }

  document.title = `${username} - CHUNIFORCE`;

  // 認証チェック
  const token = loadToken(username);
  if (!token) {
    location.href = `../login.html?next=${encodeURIComponent(username)}`;
    return;
  }

  loadUser(username, token);

  // URLコピーボタン
  const copyBtn = document.getElementById('btn-copy-url');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(location.href).then(() => {
        const span = copyBtn.querySelector('.btn-text');
        span.textContent = '✅ コピーしました';
        setTimeout(() => { span.textContent = '🔗 URLをコピー'; }, 2000);
      });
    });
  }

  // ログアウトボタン
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (window.showLogoutModal) {
        window.showLogoutModal('../');
      } else if (confirm('本当にログアウトしますか？')) {
        clearToken(username);
        location.href = `../login.html?next=${encodeURIComponent(username)}`;
      }
    });
  }
});

// ──────────────────────────────────────────────────────────
//  ユーザーデータ取得 & 描画
// ──────────────────────────────────────────────────────────
async function loadUser(username, token) {
  try {
    const res = await fetch(
      `${PROXY_URL}/user?name=${encodeURIComponent(username)}`,
      { headers: { Authorization: 'Bearer ' + token } }
    );

    if (res.status === 401) {
      clearToken(username);
      location.href = `../login.html?next=${encodeURIComponent(username)}`;
      return;
    }
    if (res.status === 404) {
      showError(`ユーザー「${escHtml(username)}」のデータがまだ公開されていません。<br>トップページで計算後に「ページを公開する」を押してください。`);
      hideLoading();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    renderUser(data);

  } catch (e) {
    console.error(e);
    showError(`データの取得に失敗しました: ${e.message}`);
  } finally {
    hideLoading();
  }
}

function renderUser(data) {
  const {
    username, displayName, chuniforce,
    bestAvg, ajcAvg, ajcBonus,
    bestJson, ajcJson, updatedAt,
  } = data;

  const badge = document.getElementById('result-username-badge');
  if (badge) badge.textContent = displayName || username;
  document.title = `${displayName || username} - CHUNIFORCE`;

  const cfValueEl = document.getElementById('cf-value');
  if (cfValueEl) cfValueEl.textContent = chuniforce.toFixed(3);

  const bdBestAvg = document.getElementById('bd-best-avg');
  const bdTheory  = document.getElementById('bd-theory-bonus');
  const bdBonus   = document.getElementById('bd-theory-count-bonus');
  if (bdBestAvg) bdBestAvg.textContent = bestAvg.toFixed(4);
  if (bdTheory)  bdTheory.textContent  = ajcAvg.toFixed(4);
  if (bdBonus)   bdBonus.textContent   = '+' + ajcBonus.toFixed(4);

  // エンブレム
  const cls     = getClassInfo(chuniforce);
  const romanEl = document.getElementById('cf-roman');
  const starsEl = document.getElementById('cf-stars');
  const labelEl = document.getElementById('cf-value-label');
  if (romanEl) {
    romanEl.textContent = cls.name;
    for (let i = 1; i <= 10; i++) romanEl.classList.remove('cf-color-' + i);
    romanEl.classList.add('cf-color-' + cls.id);
  }
  if (labelEl) {
    for (let i = 1; i <= 10; i++) labelEl.classList.remove('cf-color-' + i);
    labelEl.classList.add('cf-color-' + cls.id);
  }
  if (cfValueEl) {
    for (let i = 1; i <= 10; i++) cfValueEl.classList.remove('cf-color-' + i);
    cfValueEl.classList.add('cf-color-' + cls.id);
  }
  if (starsEl) {
    starsEl.innerHTML = Array.from({ length: 4 }, (_, i) =>
      `<div class="star-icon ${i < cls.stars ? 'active' : ''}"></div>`
    ).join('');
  }

  // 最終更新
  const updEl = document.getElementById('updated-at');
  if (updEl && updatedAt) {
    const d = new Date(updatedAt);
    updEl.textContent = `最終更新: ${d.toLocaleString('ja-JP')}`;
  }

  // ベスト枠テーブル
  const bestTbody = document.getElementById('best-tbody');
  const bestBadge = document.getElementById('best-count-badge');
  if (bestBadge) bestBadge.textContent = `${bestJson.length}曲`;
  if (bestTbody) {
    if (bestJson.length === 0) {
      bestTbody.innerHTML = '<tr><td colspan="11" class="placeholder-cell">データなし</td></tr>';
    } else {
      bestTbody.innerHTML = bestJson.map((e, i) => {
        const rank      = i + 1;
        const diffClass = `d-${(e.diff || '').toLowerCase()}`;
        const lampClass = { AJC: 'lamp-ajc', AJ: 'lamp-aj', FC: 'lamp-fc', CLR: 'lamp-none' }[e.lamp] || 'lamp-none';
        const rankInfo  = getRankInfo(e.score || 0);
        const baseBonus = rankInfo.baseBonus;
        const baseForce = baseBonus !== null ? (e.constant + baseBonus).toFixed(2) : '—';
        const scoreDelta = baseBonus !== null ? (e.scoreBonus - baseBonus) : e.scoreBonus;
        const sbSign    = scoreDelta >= 0 ? '+' : '';
        return `<tr>
          <td style="text-align:center"><span class="rank-num${rank <= 3 ? ' top3' : ''}">${rank}</span></td>
          <td title="${escHtml(e.title)}">${escHtml(truncate(e.title || '', 30))}</td>
          <td style="text-align:center"><span class="diff-badge ${diffClass}">${e.diff}</span></td>
          <td style="text-align:right">${(e.constant || 0).toFixed(1)}</td>
          <td style="text-align:right">${(e.score || 0).toLocaleString()}</td>
          <td style="text-align:center"><span class="lamp-badge ${lampClass}">${e.lamp}</span></td>
          <td style="text-align:center">${baseBonus !== null ? `<span class="rank-label ${getRankClass(rankInfo.rank)}">${rankInfo.rank}</span>` : '—'}</td>
          <td style="text-align:right;color:var(--text-muted)">${baseForce}</td>
          <td style="text-align:right;color:${scoreDelta >= 0 ? 'var(--success)' : 'var(--error)'}">${sbSign}${scoreDelta.toFixed(4)}</td>
          <td style="text-align:right;color:var(--warning)">${e.lampBonus > 0 ? '+' : ''}${(e.lampBonus || 0).toFixed(1)}</td>
          <td style="text-align:right"><strong class="force-val">${(e.force || 0).toFixed(4)}</strong></td>
        </tr>`;
      }).join('');
    }
  }

  // 理論値枠テーブル
  const theoryTbody = document.getElementById('theory-tbody');
  const theoryBadge = document.getElementById('theory-count-badge');
  if (theoryBadge) theoryBadge.textContent = `${ajcJson.length}曲`;
  if (theoryTbody) {
    if (ajcJson.length === 0) {
      theoryTbody.innerHTML = '<tr><td colspan="5" class="placeholder-cell">データなし</td></tr>';
    } else {
      theoryTbody.innerHTML = ajcJson.map((e, i) => {
        const rank      = i + 1;
        const diffClass = `d-${(e.diff || '').toLowerCase()}`;
        return `<tr>
          <td class="col-rank"><span class="rank-num${rank <= 3 ? ' top3' : ''}">#${rank}</span></td>
          <td class="col-title" style="text-align:left">${escHtml(e.title || '')}</td>
          <td class="col-diff"><span class="diff-badge ${diffClass}">${e.diff}</span></td>
          <td class="col-const" style="text-align:center">${(e.constant || 0).toFixed(1)}</td>
          <td class="col-force" style="text-align:center">${(e.singleForce || 0).toFixed(4)}</td>
        </tr>`;
      }).join('');
    }
  }

  // 結果表示
  const resultArea = document.getElementById('result-area');
  if (resultArea) {
    resultArea.classList.remove('hidden');
    resultArea.classList.add('fade-in');
  }
}


// ──────────────────────────────────────────────────────────
//  ユーティリティ
// ──────────────────────────────────────────────────────────
function getRankClass(rankName) {
  if (rankName === 'SSS+')                            return 'rank-sssp';
  if (['SSS','SS+','SS','S+','S'].includes(rankName)) return 'rank-plat';
  if (['AAA','AA','A'].includes(rankName))            return 'rank-gold';
  if (rankName === 'BBB')                             return 'rank-blue';
  if (rankName === 'C')                               return 'rank-brown';
  return 'rank-grey';
}

function showError(html) {
  const area = document.getElementById('error-area');
  const msg  = document.getElementById('error-msg');
  if (area) area.classList.remove('hidden');
  if (msg)  msg.innerHTML = html;
}

function hideLoading() {
  const area = document.getElementById('loading-area');
  if (area) area.classList.add('hidden');
}


