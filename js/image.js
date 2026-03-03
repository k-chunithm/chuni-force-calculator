import { getClassInfo } from './calc.js';
import { getCurrentRenderData, escHtml, truncate } from './render.js';

let currentImgDataUrl = null;

export function setupImageActions() {
  const btnGenerateImg = document.getElementById('btn-generate-img');
  const btnSaveImg = document.getElementById('btn-save-img');
  const btnShareX  = document.getElementById('btn-share-x');
  const captureArea    = document.getElementById('capture-area');

  if (btnGenerateImg) {
    btnGenerateImg.addEventListener('click', async () => {
      const currentRenderData = getCurrentRenderData();
      if (!currentRenderData) return;
      const { username, result } = currentRenderData;
      const {
        best50,
        bestAvg,
        chuniforce,
        chuniforceTheory,
        masTheoryCount,
        ultTheoryCount,
        theoryBest50,
        theoryBonus,
        theoryCountBonus
      } = result;

      const originalText = btnGenerateImg.innerHTML;
      btnGenerateImg.innerHTML = `<span class="btn-text">生成中...</span>`;
      btnGenerateImg.disabled = true;

      try {
        const now = new Date();
        const dateStr = now.getFullYear() + '/' +
                        String(now.getMonth()+1).padStart(2,'0') + '/' +
                        String(now.getDate()).padStart(2,'0') + ' ' +
                        String(now.getHours()).padStart(2,'0') + ':' +
                        String(now.getMinutes()).padStart(2,'0');

        const fetchImageAsBase64 = async (url) => {
          try {
            const res = await fetch(url);
            const blob = await res.blob();
            return await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            return null;
          }
        };

        const best50WithImages = await Promise.all(best50.map(async (e) => {
          const defaultImg = 'figs/favicon.png';
          const rawUrl = e.img ? `https://reiwa.f5.si/jackets/chunithm/${e.img}.webp` : defaultImg;
          let b64 = await fetchImageAsBase64(rawUrl);
          if (!b64 && e.img) b64 = 'figs/favicon.png';
          return { ...e, jacketB64: b64 };
        }));

        const theory50WithImages = await Promise.all(theoryBest50.map(async (e) => {
          const defaultImg = 'figs/favicon.png';
          const rawUrl = e.img ? `https://reiwa.f5.si/jackets/chunithm/${e.img}.webp` : defaultImg;
          let b64 = await fetchImageAsBase64(rawUrl);
          if (!b64 && e.img) b64 = 'figs/favicon.png';
          return { ...e, jacketB64: b64 };
        }));

        let gridHtml = '';
        best50WithImages.forEach((e, i) => {
          const diffClass = `d-${e.diff.toLowerCase()}`;
          gridHtml += `
            <div class="capture-song">
              <div class="c-song-rank">#${i + 1}</div>
              <div class="c-song-const" style="position: absolute; top: 6px; right: 6px; z-index: 2; font-size: 14px; font-family: var(--font-en); font-weight: bold; color: #fff; background: rgba(0,0,0,0.75); padding: 0 4px; border-radius: 4px; text-shadow: 0 1px 2px #000; border: 1px solid rgba(255,255,255,0.2);">${(e.constant || 0).toFixed(1)}</div>
              <img class="c-song-jacket" src="${e.jacketB64}" />
              <div class="c-song-details">
                <div class="c-song-meta" style="display: flex; justify-content: flex-start; margin-bottom: 2px;">
                  <span class="diff-badge ${diffClass}" style="transform: scale(0.85) origin-left;">${e.diff}</span>
                </div>
                <div class="c-song-title">${escHtml(e.title)}</div>
                <div class="c-song-stats">
                  <span class="c-song-score" style="font-size: 13px;">${e.score} ${e.lamp !== 'CLEAR' && e.lamp !== 'FAILED' ? e.lamp : ''}</span>
                  <span class="c-song-force" style="font-size: 13px;">${e.force.toFixed(4)}</span>
                </div>
              </div>
            </div>
          `;
        });

        let theoryGridHtml = '';
        theory50WithImages.forEach((e, i) => {
          const diffClass = `d-${e.diff.toLowerCase()}`;
          const rankColor = 'var(--accent3)';
          theoryGridHtml += `
            <div class="capture-song">
              <div class="c-song-rank" style="color:${rankColor};">#${i + 1}</div>
              <div class="c-song-const" style="position: absolute; top: 6px; right: 6px; z-index: 2; font-size: 14px; font-family: var(--font-en); font-weight: bold; color: #fff; background: rgba(0,0,0,0.75); padding: 0 4px; border-radius: 4px; text-shadow: 0 1px 2px #000; border: 1px solid rgba(255,255,255,0.2);">${(e.constant || 0).toFixed(1)}</div>
              <img class="c-song-jacket" src="${e.jacketB64}" />
              <div class="c-song-details">
                <div class="c-song-meta" style="display: flex; justify-content: flex-start; margin-bottom: 2px;">
                  <span class="diff-badge ${diffClass}" style="transform: scale(0.85) origin-left;">${e.diff}</span>
                </div>
                <div class="c-song-title">${escHtml(e.title)}</div>
                <div class="c-song-stats">
                  <span class="c-song-score" style="font-size: 13px;">1,010,000 AJC</span>
                  <span class="c-song-force" style="color:${rankColor}; font-weight:bold; font-size: 13px;">${e.singleForce.toFixed(4)}</span>
                </div>
              </div>
            </div>
          `;
        });

        const cls = getClassInfo(chuniforce);

        const colorMap = {
          1: '#bdc3c7',
          2: '#4aa8ff',
          3: '#2ecc71',
          4: '#ff9f43',
          5: '#ff4757',
          6: '#e056fd',
          7: '#ecf0f1',
          8: '#f1c40f',
          9: '#9b59b6',
          10: '#7c6dfa'
        };
        const emblemColor = colorMap[cls.id] || '#fff';
        const forceValue = chuniforce.toFixed(3);
        const isRainbow = (cls.id === 10);
        const fillStyle = isRainbow ? 'url(#rainbowGrad)' : emblemColor;

        let activeStars = '';
        let inactiveStars = '';
        for (let s = 1; s <= 4; s++) {
          if (s <= cls.stars) activeStars += '★';
          else inactiveStars += '☆';
        }

        const combinedSvgHtml = `
          <svg width="370" height="110" viewBox="0 0 370 110" xmlns="http://www.w3.org/2000/svg" style="display: block; overflow: visible;">
            <defs>
              <linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#ff4d4d"/>
                <stop offset="15%" stop-color="#f96d00"/>
                <stop offset="30%" stop-color="#f2cb05"/>
                <stop offset="50%" stop-color="#2ecc71"/>
                <stop offset="70%" stop-color="#4aa8ff"/>
                <stop offset="85%" stop-color="#9b59b6"/>
                <stop offset="100%" stop-color="#e056fd"/>
              </linearGradient>
              <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComponentTransfer in="blur" result="glow">
                  <feFuncA type="linear" slope="0.7" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode in="glow"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <g transform="translate(50, 0)">
              <text x="0" y="64" font-family="'Outfit', sans-serif" font-weight="900" font-size="64px" text-anchor="middle" fill="${fillStyle}" filter="url(#neonGlow)">
                ${cls.name}
              </text>
              <text x="0" y="85" font-family="'Outfit', sans-serif" font-size="20px" text-anchor="middle" letter-spacing="3">
                <tspan fill="#ffd700" filter="url(#neonGlow)">${activeStars}</tspan><tspan fill="rgba(255,255,255,0.2)">${inactiveStars}</tspan>
              </text>
            </g>

            <g transform="translate(110, 0)">
              <text x="0" y="27" font-family="'Outfit', sans-serif" font-weight="bold" font-size="15px" fill="${fillStyle}" letter-spacing="3" filter="url(#neonGlow)">
                CHUNIFORCE
              </text>
              <text x="0" y="85" font-family="'Outfit', sans-serif" font-weight="900" font-size="64px" fill="${fillStyle}" filter="url(#neonGlow)">
                ${forceValue}
              </text>
            </g>
          </svg>
        `;

        captureArea.innerHTML = `
          <div class="capture-header">
            <div class="capture-title-area">
              <div class="capture-title">
                <span class="title-logo-chuni">CHUNI</span><span class="title-logo-force">FORCE</span>
                <span class="title-text">ベスト枠対象楽曲</span>
              </div>
              <div class="capture-subtitle">By CHUNIFORCE Calculator</div>
            </div>
            <div class="capture-timestamp">
              GENERATE: ${dateStr}
            </div>
          </div>
          <div class="capture-player-info">
            <div class="capture-name-block">
              <div class="capture-name-label">Player's Name</div>
              <div class="capture-name">${escHtml(username)}</div>
            </div>
            <div class="capture-force-block" style="border: none; padding: 0;">
              <div style="display: flex; align-items: center; justify-content: flex-end;">
                ${combinedSvgHtml}
                <div class="capture-breakdown" style="display: flex; flex-direction: column; justify-content: center; gap: 8px; border-left: 1px dashed rgba(255,255,255,0.2); white-space: nowrap;">
                  <div style="font-size: 14px; color: var(--text-muted); letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: baseline; width: 200px;">
                    <span>ベスト枠</span>
                    <span style="font-family: var(--font-en); font-size: 18px; font-weight: bold; color: #fff;">${bestAvg.toFixed(4)}</span>
                  </div>
                  <div style="font-size: 14px; color: var(--text-muted); letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: baseline; width: 200px;">
                    <span>理論値枠</span>
                    <span style="font-family: var(--font-en); font-size: 18px; font-weight: bold; color: #fff;">${theoryBonus.toFixed(4)}</span>
                  </div>
                  <div style="font-size: 14px; color: var(--text-muted); letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: baseline; width: 200px;">
                    <span>理論値数ボーナス</span>
                    <span style="font-family: var(--font-en); font-size: 18px; font-weight: bold; color: var(--accent3);">+${theoryCountBonus.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="capture-theory-block">
              <div class="capture-theory-label">理論値 (MAX)</div>
              <div class="capture-theory">${chuniforceTheory.toFixed(3)}</div>
            </div>
          </div>
          <div style="display: flex; gap: 40px; padding: 0 40px; box-sizing: border-box; width: 100%;">
            <div style="flex: 1;">
              <div class="capture-grid-title" style="margin: 0 0 15px 0;">ベスト枠 (${best50.length}曲)</div>
              <div class="capture-grid" style="padding: 0; box-shadow: none;">
                ${gridHtml}
              </div>
            </div>
            <div style="flex: 1;">
              <div class="capture-grid-title" style="margin: 0 0 15px 0;">理論値枠 (${theoryBest50.length}曲)</div>
              <div class="capture-grid" style="padding: 0; box-shadow: none;">
                ${theoryGridHtml}
              </div>
            </div>
          </div>
          <div class="capture-footer">
            Generated by CHUNIFORCE Calculator<br>
            ※本画像におけるロゴ・背景・楽曲ジャケット画像の著作権は、全て著作権所有者に帰属します。<br>
            ※本画像は非公式のものであり、株式会社SEGA様及びその関連会社とは一切関係ありません。
          </div>
        `;

        const canvas = await html2canvas(captureArea, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff'
        });

        const imgDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const previewImg = document.getElementById('generated-image');
        const previewArea = document.getElementById('image-preview-area');

        currentImgDataUrl = imgDataUrl;
        previewImg.src = imgDataUrl;
        previewArea.classList.remove('hidden');

        setTimeout(() => {
          previewArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } catch (err) {
        console.error('画像生成エラー:', err);
        alert('画像の生成に失敗しました。');
      } finally {
        btnGenerateImg.innerHTML = originalText;
        btnGenerateImg.disabled = false;
      }
    });
  }

  if (btnSaveImg) {
    btnSaveImg.addEventListener('click', () => {
      const currentRenderData = getCurrentRenderData();
      if (!currentImgDataUrl || !currentRenderData) return;
      const link = document.createElement('a');
      link.href = currentImgDataUrl;
      link.download = `chuniforce_${currentRenderData.username}.jpg`;
      link.click();
    });
  }

  if (btnShareX) {
    btnShareX.addEventListener('click', async () => {
      const currentRenderData = getCurrentRenderData();
      if (!currentImgDataUrl || !currentRenderData) return;

      const shareText = `【CHUNIFORCE Calculator】\n${currentRenderData.username} の CHUNIFORCE は ${currentRenderData.result.chuniforce.toFixed(3)} です！\n\n#CHUNIFORCE #チュウニズム`;

      if (navigator.share && navigator.canShare) {
        try {
          const res = await fetch(currentImgDataUrl);
          const blob = await res.blob();
          const file = new File([blob], `chuniforce_${currentRenderData.username}.jpg`, { type: 'image/jpeg' });

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              text: shareText,
              files: [file]
            });
            return;
          }
        } catch (err) {
          if (err.name !== 'AbortError') console.error('Share failed:', err);
          return;
        }
      }

      alert('お使いの環境では画像を直接X(Twitter)の投稿画面へ転送できません。\\n画像を保存しますので、この後開くX(Twitter)の画面にて手動で画像を添付してください。');

      const link = document.createElement('a');
      link.href = currentImgDataUrl;
      link.download = `chuniforce_${currentRenderData.username}.jpg`;
      link.click();

      const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
      window.open(intentUrl, '_blank');
    });
  }
}
