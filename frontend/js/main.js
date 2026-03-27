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
    navLinks.classList.toggle('open');
    navToggle.textContent = navLinks.classList.contains('open') ? '✕' : '☰';
}

// Close menu when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        const navLinks = document.getElementById('nav-links');
        const navToggle = document.getElementById('nav-toggle');
        navLinks.classList.remove('open');
        navToggle.textContent = '☰';
    });
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    const navLinks = document.getElementById('nav-links');
    const navToggle = document.getElementById('nav-toggle');
    const navbar = document.getElementById('navbar');
    if (!navbar.contains(e.target) && navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
        navToggle.textContent = '☰';
    }
});

// ---------- Language toggle ----------
function toggleLanguage() {
    const currentLang = document.documentElement.lang;
    const newLang = currentLang === 'fr' ? 'en' : 'fr';
    document.documentElement.lang = newLang;
    document.getElementById('lang-toggle').textContent = newLang === 'fr' ? 'EN' : 'FR';
    if (window.i18n) {
        window.i18n.setLanguage(newLang);
    }
    localStorage.setItem('vnk-lang', newLang);
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
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('vnk-lang') || 'fr';
    if (savedLang !== 'fr') {
        document.documentElement.lang = savedLang;
        document.getElementById('lang-toggle').textContent = 'FR';
        if (window.i18n) {
            window.i18n.setLanguage(savedLang);
        }
    }
});
