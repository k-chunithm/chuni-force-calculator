import { fetchScores, fetchConstantMap, fetchProfile } from './api.js';
import { filterRecords, calcChuniForce } from './calc.js';
import { renderResult, setLoading, showError, hideError, hideResult, initRender } from './render.js';
import { setupImageActions } from './image.js';

document.addEventListener('DOMContentLoaded', () => {
  initRender();
  const usernameInput    = document.getElementById('username');
  const calcBtn          = document.getElementById('calc-btn');

  // --- Calculation Logic ---
  async function onCalc() {
    const username = usernameInput.value.trim();
    if (!username) {
      showError('ユーザーネームを入力してください。');
      return;
    }

    setLoading(true);
    hideError();
    hideResult();

    localStorage.setItem('chuniforce_username', username);

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

    } catch (err) {
      console.error(err);
      const msg = err.message || '';
      if (msg.includes('404') || msg.includes('403') || msg.includes('401')) {
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
  } else {
    console.error('calc-btn not found in DOM');
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

  // --- Modal Logic ---
  const menuToggleBtn = document.getElementById('menu-toggle-btn');
  const navOverlay    = document.getElementById('nav-overlay');
  const menuCloseBtn  = document.getElementById('menu-close-btn');

  const contentModal  = document.getElementById('content-modal');
  const contentModalClose = document.getElementById('content-modal-close');
  const contentModalBody  = document.getElementById('content-modal-body');

  if(menuToggleBtn && navOverlay) {
    menuToggleBtn.addEventListener('click', () => {
      menuToggleBtn.classList.toggle('open');
      if (navOverlay.classList.contains('hidden')) {
        navOverlay.classList.remove('hidden');
        navOverlay.setAttribute('aria-hidden', 'false');
      } else {
        navOverlay.classList.add('hidden');
        navOverlay.setAttribute('aria-hidden', 'true');
      }
    });

    function closeNavMenu() {
      menuToggleBtn.classList.remove('open');
      navOverlay.classList.add('hidden');
      navOverlay.setAttribute('aria-hidden', 'true');
    }
    menuCloseBtn.addEventListener('click', closeNavMenu);
    navOverlay.addEventListener('click', (e) => {
      if (e.target === navOverlay) closeNavMenu();
    });

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
        </dl>
      `
    };

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.target.getAttribute('data-target');
        if (modalContents[target]) {
          contentModalBody.innerHTML = modalContents[target];
          closeNavMenu();
          contentModal.classList.remove('hidden');
          contentModal.setAttribute('aria-hidden', 'false');
        }
      });
    });

    function closeContentModal() {
      contentModal.classList.add('hidden');
      contentModal.setAttribute('aria-hidden', 'true');
    }
    if (contentModalClose) contentModalClose.addEventListener('click', closeContentModal);
    if (contentModal) {
      contentModal.addEventListener('click', (e) => {
        if (e.target === contentModal) closeContentModal();
      });
    }
  }
});
