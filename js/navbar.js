/**
 * js/navbar.js
 * グローバルナビゲーションの初期化と制御
 */
import { loadToken } from './auth.js';

/**
 * ナビゲーションの初期化
 * @param {boolean} isSubdirectory - サブディレクトリ（/user/等）の場合はtrue
 */
export function initNavbar(isSubdirectory = false) {
  const rootPath = isSubdirectory ? '../' : './';
  
  // --- 0. HTMLの自動挿入 (存在しない場合のみ) ---
  ensureNavbarHtml(rootPath);

  const navAuthArea = document.getElementById('nav-auth-area');
  const navMypageArea = document.getElementById('nav-mypage-link-container');
  const currentUser = localStorage.getItem('cf_current_user');

  // --- 1. モバイルナビゲーションの準備 ---
  setupMobileNav(rootPath, currentUser);

  // --- 2. ログイン状態に応じた表示の切り替え ---
  if (currentUser && loadToken(currentUser)) {
    if (navMypageArea) {
      navMypageArea.innerHTML = `<a href="${rootPath}user/#${currentUser}" class="nav-item">マイページ</a>`;
    }
    if (navAuthArea) {
      navAuthArea.innerHTML = `
        <div class="dropdown-container">
          <button class="nav-item dropdown-btn">
            👤 ${currentUser} 
            <span class="nav-icon-span">
              <svg class="dropdown-icon" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </button>
          <div class="dropdown-menu">
            <a href="${rootPath}setting.html" class="dropdown-link">
              <span>設定</span>
              <svg class="link-icon" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
            <button id="nav-logout-btn" class="dropdown-link">ログアウト</button>
          </div>
        </div>
      `;
      document.getElementById('nav-logout-btn')?.addEventListener('click', () => {
        showLogoutModal(rootPath);
      });
    }
  } else {
    if (navMypageArea) navMypageArea.innerHTML = '';
    if (navAuthArea) {
      navAuthArea.innerHTML = `
        <a href="${rootPath}login.html" class="nav-item">ログイン</a>
        <a href="${rootPath}signup.html" class="nav-item nav-btn-reg">新規登録</a>
      `;
    }
  }

  // --- 3. ドロップダウンとモーダルの制御 ---
  const contentModal = document.getElementById('content-modal');
  const contentModalBody = document.getElementById('content-modal-body');
  const contentModalClose = document.getElementById('content-modal-close');

  const modalContents = {
    'modal-about': `
      <h3>CHUNIFORCEとは？</h3>
      <p>「CHUNIFORCE」は、CHUNITHMにおける新たな非公式の実力指標です。<br>
      プレイヤーの実力をより多角的に測るため、他の音楽ゲームの実力指標（VOLFORCE等）に近い概念を採用しつつ、独自のランプ補正（AJC等）や理論値へのやり込み要素を加味しています。</p>
      <p>本ツールはchunirec APIからスコアデータを取得し、以下の3つの要素を合算して最終的な総合値を算出します。</p>
      <ul style="margin-left: 1.5rem; color: var(--text); line-height: 1.8; margin-bottom: 1rem;">
        <li><strong>ベスト枠 average：</strong>各譜面の定数・スコア・ランプから算出される単曲FORCEの上位50曲平均</li>
        <li><strong>理論値枠 average：</strong>達成した理論値（1,010,000点）楽曲における単曲AJC-FORCEの上位50曲平均</li>
        <li><strong>理論値数ボーナス：</strong>MASTER/ULTIMA譜面の合計理論値達成数に応じた微小な加算ボーナス</li>
      </ul>
      <p>※本ツールはCHUNITHM公式とは関係のないファンメイドツールです。</p>
    `,
    'modal-how': `
      <h3>使い方</h3>
      <ol style="margin-left: 1.5rem; color: var(--text); line-height: 1.8;">
        <li>chunirec（<a href="https://chunirec.net" target="_blank" style="color:var(--accent3);">https://chunirec.net</a>）に登録し、チュウニズムネットからスコアデータを更新してください。</li>
        <li>chunirecの「設定」で、スコアデータが「公開」設定になっていることを確認してください。</li>
        <li>本サイトの検索窓に <strong>chunirecのユーザーネーム</strong> を入力し、「計算する」ボタンを押します。</li>
        <li>計算結果とランキング詳細、CHUNIFORCE値が表示されます。「画像を生成」ボタンで結果をキャプチャしてSNS等でシェアできます！</li>
      </ol>
    `,
    'modal-qa': `
      <h3>Q &amp; A</h3>
      <dl style="color: var(--text); line-height: 1.8;">
        <dt style="font-weight:bold; color:var(--accent); margin-top:0.8rem;">Q. ユーザーが見つからない/エラーが出る</dt>
        <dd>A. ユーザーネームが間違っているか、chunirecのスコアが非公開設定になっている可能性があります。</dd>
        <dt style="font-weight:bold; color:var(--accent); margin-top:0.8rem;">Q. 計算式はどうなっているの？</dt>
        <dd>A. 他の音楽ゲームの実力指標（VOLFORCE等）をベースにしつつ、CHUNITHM独自のランプ補正（AJC等）を加味しています。<br>さらに、「理論値枠」として、全難易度の中でスコアが理論値（1,010,000点）を満たす上位50曲に対し、譜面定数の累乗に基づいたFORCE値を算出し、その平均値をCHUNIFORCEに加算しています。また、MASおよびULT譜面の全理論値達成数に応じた小さな加算ボーナスも存在します。</dd>
        <dt style="font-weight:bold; color:var(--accent); margin-top:0.8rem;">Q. 新曲のデータが反映されない</dt>
        <dd>A. APIおよび譜面定数データが有志のサイトから提供されているため、サイト側の更新までしばらくお待ち下さい。</dd>
        <dt style="font-weight:bold; color:var(--accent); margin-top:0.8rem;">Q. API のアクセス制限（Rate Limit）に達した。アクセスできるまでどれくらい時間がかかる？</dt>
        <dd>
          A. <strong>数分〜15分程度</strong>待つと再度利用できることが多いです。<br>
          chunirec API はリクエスト数を <strong>APIトークンごと</strong> にカウントしています。
          このツールでは全ユーザーが <strong>同じ1つのトークン</strong>（k_chunithmのトークン）を共有しているため、
          アクセスが集中すると全員の合計リクエスト数がトークンの上限に達し、一時的に制限がかかります。<br>
          しばらく時間をおいてから再度お試しください🙇
        </dd>
      </dl>
    `
  };

  // ドロップダウン内のリンクからモーダルを開く
  document.addEventListener('click', (e) => {
    const targetBtn = e.target.closest('[data-target]');
    if (targetBtn) {
      const target = targetBtn.getAttribute('data-target');
      if (modalContents[target]) {
        if (contentModalBody) contentModalBody.innerHTML = modalContents[target];
        if (contentModal) {
          contentModal.classList.remove('hidden');
          contentModal.setAttribute('aria-hidden', 'false');
        }
      }
    }
  });

  const closeContentModal = () => {
    if (contentModal) {
      contentModal.classList.add('hidden');
      contentModal.setAttribute('aria-hidden', 'true');
    }
  };
  if (contentModalClose) contentModalClose.addEventListener('click', closeContentModal);
  if (contentModal) {
    contentModal.addEventListener('click', (e) => {
      if (e.target === contentModal) closeContentModal();
    });
  }

  // ドロップダウンメニューの開閉制御
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.dropdown-btn');
    if (btn) {
      e.preventDefault();
      const menu = btn.nextElementSibling;
      if (menu) {
        // 他のドロップダウンを閉じる
        document.querySelectorAll('.dropdown-menu').forEach(m => {
          if (m !== menu) m.classList.remove('show');
        });
        menu.classList.toggle('show');
      }
    } else if (!e.target.closest('.dropdown-container')) {
      // 外側クリックで閉じる
      document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
    }
  });
}

/**
 * ナビゲーションHTMLの自動挿入
 */
function ensureNavbarHtml(rootPath) {
  if (document.querySelector('.global-nav')) return;

  const html = `
    <nav class="global-nav">
      <div class="nav-inner">
        <div class="nav-left">
          <a href="${rootPath}" class="nav-logo">
            <span class="logo-chuni">CHUNI</span><span class="logo-force">FORCE</span>
          </a>
          <a href="${rootPath}calculator.html" class="nav-item m-hide">計算機</a>
          <a href="${rootPath}ranking.html" class="nav-item m-hide">ランキング</a>
          <span id="nav-mypage-link-container"></span>

          <div class="dropdown-container">
            <button class="nav-item dropdown-btn">
              ヘルプ
              <span class="nav-icon-span">
                <svg class="dropdown-icon" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </button>
            <div class="dropdown-menu">
              <button class="dropdown-link" data-target="modal-about">CHUNIFORCEとは？</button>
              <a href="${rootPath}calc.html" class="dropdown-link">
                <span>計算方法</span>
                <svg class="link-icon" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </a>
              <a href="${rootPath}class.html" class="dropdown-link">
                <span>CLASSとエンブレム</span>
                <svg class="link-icon" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </a>
              <button class="dropdown-link" data-target="modal-how">使い方</button>
              <button class="dropdown-link" data-target="modal-qa">Q & A</button>
            </div>
          </div>

          <div class="dropdown-container">
            <button class="nav-item dropdown-btn">
              その他 
              <span class="nav-icon-span">
                <svg class="dropdown-icon" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </button>
            <div class="dropdown-menu">
              <a href="${rootPath}user/" class="dropdown-link">
                <span>ユーザー一覧</span>
                <svg class="link-icon" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </a>
              <a href="${rootPath}user/statistics.html" class="dropdown-link">
                <span>ユーザー統計</span>
                <svg class="link-icon" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </a>
              <a href="${rootPath}help/term.html" class="dropdown-link">
                <span>利用規約</span>
                <svg class="link-icon" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div class="nav-right dropdown-right" id="nav-auth-area"></div>
      </div>
    </nav>
    <div id="content-modal" class="content-modal hidden" aria-hidden="true">
      <div class="content-modal-inner">
        <button id="content-modal-close" class="menu-close-btn">×</button>
        <div id="content-modal-body" class="content-modal-body"></div>
      </div>
    </div>
  `;

  // body の先頭に挿入
  document.body.insertAdjacentHTML('afterbegin', html);
}

/**
 * モバイルドロワーのセットアップ
 */
function setupMobileNav(rootPath, currentUser) {
  const navInner = document.querySelector('.nav-inner');
  if (!navInner) return;

  // ハンバーガーボタンの作成
  const toggle = document.createElement('button');
  toggle.className = 'mobile-nav-toggle';
  toggle.innerHTML = `
    <span class="hamburger-icon">
      <span></span>
      <span></span>
      <span></span>
    </span>
  `;
  navInner.appendChild(toggle);

  // ドロワーコンテナの作成
  const drawer = document.createElement('div');
  drawer.className = 'mobile-drawer';
  document.body.appendChild(drawer);

  // ドロワー内容の生成
  const updateDrawerContent = () => {
    let html = `
      <a href="${rootPath}calculator.html" class="drawer-item">計算機</a>
      <a href="${rootPath}ranking.html" class="drawer-item">ランキング</a>
    `;

    if (currentUser) {
      html += `
        <a href="${rootPath}user/#${currentUser}" class="drawer-item">マイページ</a>
        <div class="drawer-section">
          <button class="drawer-item drawer-toggle">
            <span>ユーザー設定</span>
            <svg class="link-icon" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="drawer-sub-menu">
            <div style="min-height: 0;">
              <span class="drawer-sub-item">👤 ${currentUser}さん</span>
              <a href="${rootPath}setting.html" class="drawer-sub-item">
                <span>設定</span>
                <svg class="link-icon" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </a>
              <button id="mobile-logout-btn" class="drawer-sub-item" style="background:none; border:none; color:var(--error); cursor:pointer; font-family:inherit; width:100%;">ログアウト</button>
            </div>
          </div>
        </div>
      `;
    } else {
      html += `
        <a href="${rootPath}login.html" class="drawer-item">ログイン</a>
        <a href="${rootPath}signup.html" class="drawer-item">新規登録</a>
      `;
    }

    html += `
      <div class="drawer-section">
        <button class="drawer-item drawer-toggle">
          <span>ヘルプ</span>
          <svg class="link-icon" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="drawer-sub-menu">
          <div style="min-height: 0;">
            <button class="drawer-sub-item" data-target="modal-about" style="background:none; border:none; color:inherit; cursor:pointer; font-family:inherit; width:100%;">CHUNIFORCEとは？</button>
            <a href="${rootPath}calc.html" class="drawer-sub-item">
              <span>計算方法</span>
              <svg class="link-icon" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
            <a href="${rootPath}class.html" class="drawer-sub-item">
              <span>CLASSとエンブレム</span>
              <svg class="link-icon" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
            <button class="drawer-sub-item" data-target="modal-how" style="background:none; border:none; color:inherit; cursor:pointer; font-family:inherit; width:100%;">使い方</button>
            <button class="drawer-sub-item" data-target="modal-qa" style="background:none; border:none; color:inherit; cursor:pointer; font-family:inherit; width:100%;">Q & A</button>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <button class="drawer-item drawer-toggle">
          <span>その他</span>
          <svg class="link-icon" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="drawer-sub-menu">
          <div style="min-height: 0;">
            <a href="${rootPath}user/" class="drawer-sub-item">
              <span>ユーザー一覧</span>
              <svg class="link-icon" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
            <a href="${rootPath}user/statistics.html" class="drawer-sub-item">
              <span>ユーザー統計</span>
              <svg class="link-icon" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
            <a href="${rootPath}help/term.html" class="drawer-sub-item">
              <span>利用規約</span>
              <svg class="link-icon" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    `;

    drawer.innerHTML = html;

    // アコーディオンの制御
    drawer.querySelectorAll('.drawer-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.closest('.drawer-section');
        const isOpen = section.classList.contains('open');
        
        // 他を閉じる場合
        drawer.querySelectorAll('.drawer-section').forEach(s => {
          s.classList.remove('open');
          s.querySelector('.drawer-toggle')?.classList.remove('active');
        });

        if (!isOpen) {
          section.classList.add('open');
          btn.classList.add('active');
        }
      });
    });

    // ログアウトイベント
    document.getElementById('mobile-logout-btn')?.addEventListener('click', () => {
      showLogoutModal(rootPath);
    });
  };

  updateDrawerContent();

  // 開閉ロジック
  toggle.addEventListener('click', () => {
    const isOpening = !drawer.classList.contains('open');
    toggle.classList.toggle('active');
    drawer.classList.toggle('open');
    document.body.style.overflow = drawer.classList.contains('open') ? 'hidden' : '';

    // 閉じるときはアコーディオンもリセットする
    if (!isOpening) {
      drawer.querySelectorAll('.drawer-section').forEach(s => {
        s.classList.remove('open');
        s.querySelector('.drawer-toggle')?.classList.remove('active');
      });
    }
  });

  // ドロワー内のリンククリックで閉じる
  drawer.addEventListener('click', (e) => {
    if (e.target.closest('a') || e.target.closest('button[data-target]')) {
      toggle.classList.remove('active');
      drawer.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
}

/**
 * ログアウト用カスタムモーダルの表示
 */
export function showLogoutModal(rootPath) {
  const modal = document.getElementById('content-modal');
  const body = document.getElementById('content-modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="text-align: center; padding: 1rem 0;">
      <h3 style="margin-bottom: 1.5rem;">ログアウト確認</h3>
      <p style="margin-bottom: 2rem; color: var(--text);">本当にログアウトしますか？</p>
      <div style="display: flex; gap: 1rem; justify-content: center;">
        <button id="modal-logout-confirm" class="calc-btn" style="background: var(--error); padding: 0.8rem 2rem; min-width: 120px;">ログアウトする</button>
        <button id="modal-logout-cancel" class="calc-btn" style="background: transparent; border: 1px solid var(--border); color: var(--text-muted); padding: 0.8rem 2rem; min-width: 120px; box-shadow: none;">キャンセル</button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  const handleConfirm = () => {
    localStorage.removeItem('cf_current_user');
    location.href = rootPath + 'index.html';
  };

  const handleCancel = () => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    // クリーンアップ
    document.getElementById('modal-logout-confirm')?.removeEventListener('click', handleConfirm);
    document.getElementById('modal-logout-cancel')?.removeEventListener('click', handleCancel);
  };

  document.getElementById('modal-logout-confirm')?.addEventListener('click', handleConfirm);
  document.getElementById('modal-logout-cancel')?.addEventListener('click', handleCancel);
}

// グローバルにアクセスできるようにする
window.showLogoutModal = showLogoutModal;
