document.addEventListener('DOMContentLoaded', function() {
  // メニューの開閉
  const menuBtn = document.getElementById('menu-toggle-btn');
  const closeBtn = document.getElementById('menu-close-btn');
  const overlay = document.getElementById('nav-overlay');
  if(menuBtn && closeBtn && overlay) {
    menuBtn.addEventListener('click', () => {
      menuBtn.classList.add('open');
      overlay.classList.remove('hidden');
    });
    closeBtn.addEventListener('click', () => {
      menuBtn.classList.remove('open');
      overlay.classList.add('hidden');
    });
  }
});
