import { fetchScores, fetchConstantMap, fetchProfile } from './api.js';
import { filterRecords, calcChuniForce } from './calc.js';
import { renderResult, setLoading, showError, showRateLimitError, hideError, hideResult, initRender, getCurrentRenderData } from './render.js';
import { setupImageActions } from './image.js';
import { loadToken, login, register } from './auth.js';
import { initNavbar } from './navbar.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavbar(false);
  initRender();
  const usernameInput    = document.getElementById('username');
  const calcBtn          = document.getElementById('btn-generate-img');

  // ──────────────────────────────────────────
  //  Home / App Container Split Logic
  // ──────────────────────────────────────────
  const homeContainer    = document.getElementById('home-container');
  const appContainer     = document.getElementById('app-container');
  const navAuthArea      = document.getElementById('nav-auth-area');
  const navMypageArea    = document.getElementById('nav-mypage-link-container');

  function showApp(username) {
    if (appContainer) appContainer.classList.remove('hidden');
    if (usernameInput && username) usernameInput.value = username;
  }

  // 初期ログインチェック
  const currentUser = localStorage.getItem('cf_current_user');
  const validToken = currentUser && loadToken(currentUser);
  const homeAuthActions = document.getElementById('home-auth-actions');

  if (homeAuthActions && validToken) {
    homeAuthActions.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; width: 100%;">
        <a href="user/#${currentUser}" class="calc-btn" style="background: #673ab7; color: #fff; border: none; padding: 1.2rem 4rem; font-size: 1.1rem; border-radius: 8px; box-shadow: 0 4px 15px rgba(103, 58, 183, 0.3); text-decoration: none; display: flex; align-items: center; justify-content: center; width: fit-content; min-width: 300px;">
          <span class="btn-text">マイページへ移動</span>
        </a>
        <a href="calculator.html" class="calc-btn" style="background: #673ab7; color: #fff; border: none; padding: 1.2rem 4rem; font-size: 1.1rem; border-radius: 8px; box-shadow: 0 4px 15px rgba(103, 58, 183, 0.3); text-decoration: none; display: flex; align-items: center; justify-content: center; width: fit-content; min-width: 300px;">
          <span class="btn-text">CHUNIFORCEを計算</span>
        </a>
        <button id="home-logout-btn" class="calc-btn" style="background: transparent; border: 1px solid var(--border); color: var(--error); padding: 0.7rem 2rem; font-size: 0.9rem; border-radius: 8px; margin-top: 1rem; cursor: pointer; box-shadow: none; display: flex; align-items: center; justify-content: center; width: fit-content;">
          <span class="btn-text">ログアウト</span>
        </button>
      </div>
    `;
    document.getElementById('home-logout-btn')?.addEventListener('click', () => {
      if (window.showLogoutModal) {
        window.showLogoutModal('./');
      }
    });

    const homeSkipContainer = document.getElementById('home-skip-container');
    if (homeSkipContainer) homeSkipContainer.style.display = 'none';
  } else {
    showApp(currentUser);
  }



  // ──────────────────────────────────────────



  // ──────────────────────────────────────────
  //  定数
  // ──────────────────────────────────────────
  const CACHE_KEY_PREFIX  = 'chuniforce_cache_';  // localStorage キー prefix
  const CACHE_TTL_MS      = 5 * 60 * 1000;        // キャッシュ有効期限: 5分
  const COOLDOWN_SEC      = 30;                    // 計算後クールダウン: 30秒

  let cooldownTimer = null;

  // ── キャッシュユーティリティ ──
  function saveCache(username, payload) {
    try {
      localStorage.setItem(
        CACHE_KEY_PREFIX + username.toLowerCase(),
        JSON.stringify({ ts: Date.now(), payload })
      );
    } catch (_) { /* quota 超えは無視 */ }
  }

  function loadCache(username) {
    try {
      const raw = localStorage.getItem(CACHE_KEY_PREFIX + username.toLowerCase());
      if (!raw) return null;
      const { ts, payload } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS) return null;   // 期限切れ
      return { ...payload, ts };
    } catch (_) {
      return null;
    }
  }

  // ── ボタンクールダウン（計算成功後30秒） ──
  function startCooldown() {
    if (cooldownTimer) return;
    let remaining = COOLDOWN_SEC;

    function tick() {
      if (!calcBtn) return;
      if (remaining > 0) {
        calcBtn.disabled = true;
        const textEl = calcBtn.querySelector('.btn-text');
        if (textEl) textEl.textContent = `${remaining}秒 お待ちください`;
        remaining--;
        cooldownTimer = setTimeout(tick, 1000);
      } else {
        calcBtn.disabled = false;
        const textEl = calcBtn.querySelector('.btn-text');
        if (textEl) textEl.textContent = '画像を生成';
        cooldownTimer = null;
      }
    }
    tick();
  }

  // ── キャッシュバッジ表示 ──
  function showCacheBadge(ageMs) {
    const existing = document.getElementById('cache-badge');
    if (existing) existing.remove();

    const ageSec = Math.round(ageMs / 1000);
    const ageStr = ageSec < 60 ? `${ageSec}秒前` : `${Math.round(ageSec / 60)}分前`;

    const badge = document.createElement('span');
    badge.id = 'cache-badge';
    badge.style.cssText =
      'display:inline-flex;align-items:center;gap:0.3rem;' +
      'margin-left:0.6rem;padding:0.15rem 0.7rem;border-radius:20px;' +
      'font-size:0.75rem;font-weight:600;vertical-align:middle;' +
      'background:rgba(0,229,255,.12);color:#00e5ff;' +
      'border:1px solid rgba(0,229,255,.3);';
    badge.innerHTML = `キャッシュ表示中（${ageStr}のデータ）`;

    const formRow = calcBtn && calcBtn.parentNode;
    if (formRow) {
      // formRow の後ろに段落として差し込む
      const wrap = document.createElement('p');
      wrap.style.cssText = 'margin-top:0.5rem;';
      wrap.appendChild(badge);
      formRow.parentNode.insertBefore(wrap, formRow.nextSibling);
    }
  }

  function removeCacheBadge() {
    const b = document.getElementById('cache-badge');
    if (b) b.parentNode && b.parentNode.tagName === 'P' ? b.parentNode.remove() : b.remove();
  }

  // --- Calculation Logic ---
  async function onCalc() {
    const username = usernameInput.value.trim();
    if (!username) {
      showError('ユーザーネームを入力してください。');
      return;
    }

    // 認証チェック
    const hasToken = !!loadToken(username);
    const skipAuth = sessionStorage.getItem('skipAuth_' + username.toLowerCase()) === 'true';

    if (!hasToken && !skipAuth) {
      openAuthModal(username);
      return;
    }

    doCalc(username);
  }

  async function doCalc(username) {
    hideError();
    hideResult();
    removeCacheBadge();
    localStorage.setItem('chuniforce_username', username);

    // ── キャッシュヒット ──
    const cached = loadCache(username);
    if (cached) {
      const ageMs = Date.now() - cached.ts;
      console.log(`[cache] HIT for "${username}" (${Math.round(ageMs / 1000)}s ago)`);
      renderResult(cached.displayUsername, cached.result);
      showCacheBadge(ageMs);
      // 自動画像生成
      import('./image.js').then(m => m.triggerImageGeneration());
      return;
    }

    setLoading(true);

    try {
      const [records, constMap, profile] = await Promise.all([
        fetchScores(username),
        fetchConstantMap(),
        fetchProfile(username),
      ]);

      let displayUsername = username;
      if (profile && profile.player_name) {
        displayUsername = profile.player_name;
      }

      const filtered = filterRecords(records);
      if (filtered.length === 0) {
        showError('対象難易度（MAS/ULT/EXP/ADV/BAS）のスコアデータが取得できませんでした。スコアを公開状態に設定しているか確認してください。');
        return;
      }

      const result = calcChuniForce(filtered, constMap);
      renderResult(displayUsername, result);

      // --- 2段階ローディング: 画像生成フェーズ ---
      setLoading(true, '画像を生成中...');
      try {
        const { triggerImageGeneration } = await import('./image.js');
        await triggerImageGeneration();
      } catch (e) {
        console.error("Image generation failed:", e);
      }

      // --- ログイン中なら自動でユーザーデータを保存 (マイページ用) ---
      const currentUser = localStorage.getItem('cf_current_user');
      if (currentUser && currentUser.toLowerCase() === username.toLowerCase() && loadToken(currentUser)) {
        try {
          const { getAuthHeaders } = await import('./auth.js');
          const PROXY_URL = 'https://chunirec-proxy.k-chunithm.workers.dev';
          fetch(`${PROXY_URL}/user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(currentUser)
            },
            body: JSON.stringify({
              username:          currentUser,
              displayName:       displayUsername,
              chuniforce:        result.chuniforce,
              chuniforceTheory:  result.chuniforceTheory,
              bestAvg:           result.bestAvg,
              ajcAvg:            result.theoryBonus,
              ajcBonus:          result.theoryCountBonus,
              ajcMasCount:       result.masTheoryCount,
              ajcMasTotal:       result.allMasTheoryCount,
              ajcUltCount:       result.ultTheoryCount,
              ajcUltTotal:       result.allUltTheoryCount,
              bestJson:          result.best50,
              ajcJson:           result.theoryBest50,
              rating:      profile && profile.rating_max ? parseFloat(profile.rating_max) : (profile && profile.rating ? parseFloat(profile.rating) : 0),
            }),
          }).catch(e => console.error("Auto-save failed:", e));
        } catch (e) {
          console.error("Auto-save import/prep failed:", e);
        }
      }
      // -------------------------------------------------------------

      // キャッシュ保存 & クールダウン開始
      saveCache(username, { displayUsername, result });
      startCooldown();

    } catch (err) {
      console.error(err);
      const msg = err.message || '';
      const status = err.status ?? (msg.match(/\d{3}/)?.[0] ? parseInt(msg.match(/\d{3}/)[0]) : null);

      if (status === 429 || msg.includes('429')) {
        showRateLimitError(60);
      } else if (msg.includes('404') || msg.includes('403') || msg.includes('401')) {
        showError('ユーザーが見つかりませんでした。ユーザーネームを確認してください。');
      } else if (msg.includes('private') || msg.includes('非公開')) {
        showError('スコアが非公開に設定されています。');
      } else {
        showError(`通信エラーが発生しました: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  if (calcBtn) {
    calcBtn.addEventListener('click', onCalc);
  }

  if (usernameInput) {
    usernameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onCalc();
    });

    const savedUser = localStorage.getItem('chuniforce_username');
    if (savedUser) usernameInput.value = savedUser;
  }

  // --- Setup image generation and sharing ---
  setupImageActions();

  // --- Navigation & Modal Logic ---
  const contentModal  = document.getElementById('content-modal');
  const contentModalClose = document.getElementById('content-modal-close');
  const contentModalBody  = document.getElementById('content-modal-body');

  // メッセージ表示処理
  function showStatus(msg, isError) {
    const el = document.getElementById('main-status');
    if (!el) return;
    el.textContent = msg;
    el.style.background = isError ? 'rgba(244, 67, 54, 0.1)' : 'rgba(76, 175, 80, 0.1)';
    el.style.color = isError ? '#e57373' : '#81c784';
    el.style.border = `1px solid ${isError ? 'rgba(244, 67, 54, 0.3)' : 'rgba(76, 175, 80, 0.3)'}`;
    el.style.display = 'block';

    setTimeout(() => {
      el.style.display = 'none';
    }, 6000);
  }

  // クエリパラメータのチェック
  const params = new URLSearchParams(window.location.search);
  if (params.get('deleted') === 'true') {
    showStatus('アカウントの削除に成功しました。', false);
    // URLからパラメータを消去（履歴に残さない）
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
