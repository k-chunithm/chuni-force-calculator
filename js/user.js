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
  
  const handleUrl = () => {
    const username = decodeURIComponent(location.hash.slice(1));
    
    // エラーエリアを隠す
    const errorArea = document.getElementById('error-area');
    if (errorArea) errorArea.classList.add('hidden');

    if (!username) {
      loadUserList();
      return;
    }

    // ユーザーリストエリアを隠す
    const userListArea = document.getElementById('user-list-area');
    if (userListArea) userListArea.classList.add('hidden');

    document.title = `${username} - CHUNIFORCE`;

    // 認証チェック（任意）
    const token = loadToken(username);
    // トークンがなくても、公開プロフィールなら閲覧可能にする
    loadUser(username, token);

    // URLコピーボタンの設定など
    setupActionButtons(username);
  };

  handleUrl();
  window.addEventListener('hashchange', handleUrl);

  // タブ切り替えの設定
  setupTabs();
});

function setupActionButtons(username) {
  // URLコピーボタン
  const copyBtn = document.getElementById('btn-copy-url');
  if (copyBtn) {
    // 既存のイベントリスナーをクリアするために再生成
    const newBtn = copyBtn.cloneNode(true);
    copyBtn.parentNode.replaceChild(newBtn, copyBtn);
    newBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(location.href).then(() => {
        const span = newBtn.querySelector('.btn-text');
        span.textContent = '✅ コピーしました';
        setTimeout(() => { span.textContent = '🔗 URLをコピー'; }, 2000);
      });
    });
  }

  // ログアウトボタン
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    const newLogout = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogout, logoutBtn);
    newLogout.addEventListener('click', () => {
      if (window.showLogoutModal) {
        window.showLogoutModal('../');
      } else if (confirm('本当にログアウトしますか？')) {
        clearToken(username);
        location.href = `../login.html?next=${encodeURIComponent(username)}`;
      }
    });
  }
}

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
    if (res.status === 403) {
      showError(`このユーザーのページは非公開に設定されています。<br><span style="font-size:0.85rem; color:var(--text-muted);">設定画面で「マイページの公開設定」をオンにすると、他のユーザーからも閲覧可能になります。</span>`);
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

// ──────────────────────────────────────────────────────────
//  ユーザー一覧取得 & 描画
// ──────────────────────────────────────────────────────────
async function loadUserList() {
  document.title = 'ユーザー一覧 - CHUNIFORCE';
  const resultArea = document.getElementById('result-area');
  const userListArea = document.getElementById('user-list-area');
  const tbody = document.getElementById('user-list-tbody');
  const countBadge = document.getElementById('user-list-count');

  if (resultArea) resultArea.classList.add('hidden');
  if (userListArea) userListArea.classList.remove('hidden');

  try {
    // ランキングAPIを利用して公開ユーザーを取得 (chuniforceカテゴリ)
    const res = await fetch(`${PROXY_URL}/ranking?category=chuniforce`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '不明なエラー');
    
    const users = json.data || [];
    
    // 描画関数
    const renderList = (filterText = '') => {
      const filtered = users.filter(u => {
        const query = filterText.toLowerCase();
        const dName = (u.display_name || '').toLowerCase();
        const uName = (u.username || '').toLowerCase();
        return dName.includes(query) || uName.includes(query);
      });

      if (countBadge) countBadge.textContent = `${filtered.length}人`;

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="placeholder-cell">該当するユーザーはいません</td></tr>';
      } else {
        tbody.innerHTML = filtered.map(u => {
          const cls = getClassInfo(u.value);
          return `
            <tr class="user-list-row ${u.is_public === 0 ? 'is-private' : ''}">
              <td>
                <div style="display:flex; align-items:center; gap:6px;">
                  <a href="#${encodeURIComponent(u.username)}" class="user-name-main ranking-user-link">${escHtml(u.display_name || u.username)}</a>
                  ${u.is_public === 0 ? `
                    <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; opacity:0.6;">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  ` : ''}
                </div>
              </td>
              <td>
                <span class="user-id-sub" style="font-size: 0.9rem;">@${escHtml(u.username)}</span>
              </td>
              <td style="text-align:right">
                <div class="user-force-cell">
                  <span class="cf-color-${cls.id} class-label-mini">${cls.name}</span>
                  <strong class="force-val cf-color-${cls.id}">${u.value.toFixed(3)}</strong>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    };

    // 初回描画
    renderList();

    // 検索入力イベント
    const searchInput = document.getElementById('user-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        renderList(e.target.value);
      });
    }

    // (ハッシュ変更の監視は DOMContentLoaded 内の統合リスナーで行うため削除)

  } catch (e) {
    console.error(e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="placeholder-cell" style="color:var(--error);">読み込み失敗: ${e.message}</td></tr>`;
  } finally {
    hideLoading();
  }
}

function renderUser(data) {
  const {
    username, displayName, chuniforce,
    bestAvg, ajcAvg, ajcBonus,
    ajcMasCount, ajcMasTotal,
    ajcUltCount, ajcUltTotal,
    bestJson, ajcJson, updatedAt,
  } = data;

  const bgMasCount = document.getElementById('ajc-mas-count');
  const bgMasTotal = document.getElementById('ajc-mas-total');
  const bgUltCount = document.getElementById('ajc-ult-count');
  const bgUltTotal = document.getElementById('ajc-ult-total');
  const bgAllCount = document.getElementById('ajc-all-count');
  const bgAllTotal = document.getElementById('ajc-all-total');

  if (bgMasCount) bgMasCount.textContent = ajcMasCount || 0;
  if (bgMasTotal) bgMasTotal.textContent = ajcMasTotal || 0;
  if (bgUltCount) bgUltCount.textContent = ajcUltCount || 0;
  if (bgUltTotal) bgUltTotal.textContent = ajcUltTotal || 0;
  if (bgAllCount) bgAllCount.textContent = (ajcMasCount || 0) + (ajcUltCount || 0);
  if (bgAllTotal) bgAllTotal.textContent = (ajcMasTotal || 0) + (ajcUltTotal || 0);

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

  // ボーナスタブ内の強調表示
  const bonusLarge = document.getElementById('bonus-value-large');
  if (bonusLarge) bonusLarge.textContent = '+' + ajcBonus.toFixed(4);

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

// ──────────────────────────────────────────────────────────
//  タブ切り替えロジック
// ──────────────────────────────────────────────────────────
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');

      // ボタンの state 更新
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // コンテンツの表示更新
      tabContents.forEach(content => {
        if (content.id === target) {
          content.classList.remove('hidden');
        } else {
          content.classList.add('hidden');
        }
      });
    });
  });
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


