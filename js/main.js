// ============ Shared site behavior ============

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');
if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
  });
}

// ---- Light/dark theme toggle ----
// Note: the actual theme is already applied before this file loads, via a
// small inline script in each page's <head> (prevents a flash of the wrong
// theme). This just wires up the button and keeps it in sync.
const THEME_KEY = 'furqan-theme';
const themeToggleBtn = document.getElementById('themeToggle');

function applyThemeIcon(theme) {
  if (themeToggleBtn) {
    themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
}

applyThemeIcon(document.documentElement.getAttribute('data-theme') || 'light');

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    applyThemeIcon(next);
  });
}

// Gentle entrance for the homepage star mark (skips if user prefers reduced motion)
const khatam = document.getElementById('khatam');
if (khatam && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  khatam.style.opacity = '0';
  khatam.style.transform = 'scale(0.92) rotate(-6deg)';
  khatam.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
  requestAnimationFrame(() => {
    setTimeout(() => {
      khatam.style.opacity = '1';
      khatam.style.transform = 'scale(1) rotate(0deg)';
    }, 80);
  });
}
