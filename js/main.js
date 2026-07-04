// ============ Shared site behavior ============

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');
if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
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
