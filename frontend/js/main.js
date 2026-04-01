/* ============================================
   VNK Automatisation Inc. - Main JavaScript
   ============================================ */

// ---------- Navbar scroll effect ----------
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// ---------- Mobile menu toggle ----------
function toggleMenu() {
    const navLinks = document.getElementById('nav-links');
    const navToggle = document.getElementById('nav-toggle');
    const overlay = document.getElementById('nav-mobile-overlay');
    const iconOpen = navToggle?.querySelector('.nav-icon-open');
    const iconClose = navToggle?.querySelector('.nav-icon-close');

    const isOpen = navLinks.classList.toggle('open');

    // Switcher les icônes
    if (iconOpen) iconOpen.style.display = isOpen ? 'none' : 'block';
    if (iconClose) iconClose.style.display = isOpen ? 'block' : 'none';

    // Overlay
    if (overlay) overlay.classList.toggle('active', isOpen);

    // Accessibilité
    if (navToggle) navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

// Close menu when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        const navLinks = document.getElementById('nav-links');
        const navToggle = document.getElementById('nav-toggle');
        const overlay = document.getElementById('nav-mobile-overlay');
        const iconOpen = navToggle?.querySelector('.nav-icon-open');
        const iconClose = navToggle?.querySelector('.nav-icon-close');

        navLinks.classList.remove('open');
        if (iconOpen) iconOpen.style.display = 'block';
        if (iconClose) iconClose.style.display = 'none';
        if (overlay) overlay.classList.remove('active');
        if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    });
});

// Close menu when clicking outside (overlay handles most cases)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const navLinks = document.getElementById('nav-links');
        if (navLinks?.classList.contains('open')) toggleMenu();
    }
});

// ---------- Language toggle ----------
function toggleLanguage() {
    const currentLang = localStorage.getItem('vnk-lang') || 'fr';
    const newLang = currentLang === 'fr' ? 'en' : 'fr';
    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.textContent = newLang === 'fr' ? 'EN' : 'FR';
    }
    if (window.i18n) {
        window.i18n.setLanguage(newLang);
    }
}

// ---------- Smooth scroll for anchor links ----------
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ---------- Active nav link based on current page ----------
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-link').forEach(link => {
    const linkPage = link.getAttribute('href');
    if (linkPage === currentPage) {
        link.classList.add('active');
    } else {
        link.classList.remove('active');
    }
});

// ---------- Load saved language on page load ----------
// Note: i18n.js gère l'application des traductions via DOMContentLoaded
// Ce bloc met uniquement à jour le bouton de langue
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('vnk-lang') || 'fr';
    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        langToggle.textContent = savedLang === 'fr' ? 'EN' : 'FR';
    }
});