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

    /* ============================================
   Additional Page Styles
   ============================================ */

/* ---------- Service Detail Pages ---------- */
.service - detail {
    padding: var(--spacing - xl) 0;
    background: var(--color - white);
}

.service - detail - alt {
    background: var(--color - bg);
}

.service - detail - grid {
    display: grid;
    grid - template - columns: 1.5fr 1fr;
    gap: var(--spacing - lg);
    align - items: start;
}

.service - detail - icon {
    font - size: 3rem;
    margin - bottom: var(--spacing - sm);
}

.service - detail - content h2 {
    font - size: 1.8rem;
    font - weight: 700;
    color: var(--color - primary);
    margin - bottom: var(--spacing - sm);
}

.service - detail - content p {
    color: var(--color - text);
    margin - bottom: var(--spacing - md);
    font - size: 1rem;
    line - height: 1.7;
}

.service - detail - includes h4,
.service - detail - brands h4 {
    font - size: 0.9rem;
    font - weight: 700;
    color: var(--color - text);
    text - transform: uppercase;
    letter - spacing: 0.5px;
    margin - bottom: var(--spacing - sm);
}

.service - list {
    list - style: none;
    display: flex;
    flex - direction: column;
    gap: 0.5rem;
    margin - bottom: var(--spacing - md);
}

.service - list li {
    padding - left: 1.5rem;
    position: relative;
    font - size: 0.95rem;
    color: var(--color - text);
}

.service - list li::before {
    content: '✓';
    position: absolute;
    left: 0;
    color: var(--color - success);
    font - weight: 700;
}

.brands - tags {
    display: flex;
    flex - wrap: wrap;
    gap: 0.5rem;
}

.brand - tag {
    background: var(--color - light - blue);
    color: var(--color - primary);
    padding: 0.3rem 0.75rem;
    border - radius: 20px;
    font - size: 0.8rem;
    font - weight: 500;
}

/* ---------- Pricing Cards ---------- */
.pricing - card {
    background: var(--color - white);
    border - radius: var(--border - radius - lg);
    padding: var(--spacing - md);
    box - shadow: var(--shadow);
    border: 1px solid var(--color - border);
    position: sticky;
    top: calc(var(--nav - height) + 1rem);
}

.pricing - card h3 {
    font - size: 1rem;
    font - weight: 700;
    color: var(--color - primary);
    margin - bottom: var(--spacing - md);
    padding - bottom: var(--spacing - sm);
    border - bottom: 1px solid var(--color - border);
}

.pricing - option {
    padding: var(--spacing - sm) 0;
    border - bottom: 1px solid var(--color - border);
}

.pricing - option: last - of - type {
    border - bottom: none;
}

.pricing - featured {
    background: rgba(27, 79, 138, 0.05);
    margin: 0 calc(-1 * var(--spacing - md));
    padding: var(--spacing - sm) var(--spacing - md);
    border - left: 3px solid var(--color - primary);
}

.pricing - name {
    font - size: 0.85rem;
    font - weight: 600;
    color: var(--color - text);
    margin - bottom: 0.25rem;
}

.pricing - amount {
    font - size: 1.1rem;
    font - weight: 700;
    color: var(--color - primary);
}

.pricing - note {
    font - size: 0.75rem;
    color: var(--color - success);
    margin - top: 0.2rem;
}

/* ---------- About Page ---------- */
.about - founder {
    padding: var(--spacing - xl) 0;
}

.founder - grid {
    display: grid;
    grid - template - columns: 1.5fr 1fr;
    gap: var(--spacing - lg);
    align - items: start;
}

.founder - content h2 {
    font - size: 2rem;
    font - weight: 700;
    color: var(--color - primary);
    margin - bottom: 0.25rem;
}

.founder - role {
    font - size: 1rem;
    color: var(--color - text - light);
    margin - bottom: var(--spacing - md);
}

.founder - content p {
    margin - bottom: var(--spacing - sm);
    line - height: 1.7;
}

.founder - values {
    margin - top: var(--spacing - md);
    display: flex;
    flex - direction: column;
    gap: var(--spacing - sm);
}

.value - item {
    display: flex;
    align - items: flex - start;
    gap: var(--spacing - sm);
}

.value - letter {
    width: 40px;
    height: 40px;
    background: var(--color - primary);
    color: var(--color - white);
    border - radius: 50 %;
    display: flex;
    align - items: center;
    justify - content: center;
    font - size: 1.2rem;
    font - weight: 800;
    flex - shrink: 0;
}

.value - item strong {
    display: block;
    font - weight: 700;
    color: var(--color - primary);
    margin - bottom: 0.25rem;
}

.value - item p {
    font - size: 0.9rem;
    color: var(--color - text - light);
    margin: 0;
}

.founder - card {
    background: var(--color - white);
    border - radius: var(--border - radius - lg);
    padding: var(--spacing - md);
    box - shadow: var(--shadow);
    border: 1px solid var(--color - border);
    text - align: center;
    position: sticky;
    top: calc(var(--nav - height) + 1rem);
}

.founder - avatar {
    width: 80px;
    height: 80px;
    background: linear - gradient(135deg, var(--color - primary), var(--color - secondary));
    color: var(--color - white);
    border - radius: 50 %;
    display: flex;
    align - items: center;
    justify - content: center;
    font - size: 1.2rem;
    font - weight: 800;
    margin: 0 auto var(--spacing - sm);
}

.founder - card h3 {
    font - size: 1.1rem;
    font - weight: 700;
    color: var(--color - primary);
    margin - bottom: 0.25rem;
}

.founder - card > p {
    font - size: 0.85rem;
    color: var(--color - text - light);
    margin - bottom: var(--spacing - md);
}

.founder - info {
    text - align: left;
    margin - bottom: var(--spacing - sm);
}

.info - item {
    display: flex;
    justify - content: space - between;
    padding: 0.5rem 0;
    border - bottom: 1px solid var(--color - border);
    font - size: 0.85rem;
}

.info - item: last - child {
    border - bottom: none;
}

.info - label {
    font - weight: 600;
    color: var(--color - text - light);
}

.about - expertise {
    padding: var(--spacing - xl) 0;
    background: var(--color - bg);
}

.expertise - grid {
    display: grid;
    grid - template - columns: repeat(3, 1fr);
    gap: var(--spacing - md);
}

.expertise - card {
    background: var(--color - white);
    border - radius: var(--border - radius - lg);
    padding: var(--spacing - md);
    border: 1px solid var(--color - border);
}

.expertise - card h4 {
    font - size: 1rem;
    font - weight: 700;
    color: var(--color - primary);
    margin - bottom: var(--spacing - sm);
    padding - bottom: var(--spacing - xs);
    border - bottom: 2px solid var(--color - light - blue);
}

.expertise - list {
    list - style: none;
    display: flex;
    flex - direction: column;
    gap: 0.4rem;
}

.expertise - list li {
    font - size: 0.9rem;
    color: var(--color - text);
    padding - left: 1rem;
    position: relative;
}

.expertise - list li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--color - secondary);
    font - size: 0.8rem;
}

.about - commitment {
    padding: var(--spacing - xl) 0;
}

.commitment - grid {
    display: grid;
    grid - template - columns: repeat(4, 1fr);
    gap: var(--spacing - md);
}

.commitment - item {
    text - align: center;
    padding: var(--spacing - md);
}

.commitment - icon {
    font - size: 2.5rem;
    margin - bottom: var(--spacing - sm);
}

.commitment - item h4 {
    font - weight: 700;
    color: var(--color - primary);
    margin - bottom: var(--spacing - xs);
}

.commitment - item p {
    font - size: 0.9rem;
    color: var(--color - text - light);
}

/* ---------- Contact Page ---------- */
.contact - section {
    padding: var(--spacing - xl) 0;
}

.contact - grid {
    display: grid;
    grid - template - columns: 1.2fr 1fr;
    gap: var(--spacing - lg);
    align - items: start;
}

.contact - form - wrapper h2 {
    font - size: 1.5rem;
    font - weight: 700;
    color: var(--color - primary);
    margin - bottom: 0.5rem;
}

.contact - form - wrapper > p {
    color: var(--color - text - light);
    margin - bottom: var(--spacing - md);
}

.form - row {
    display: grid;
    grid - template - columns: 1fr 1fr;
    gap: var(--spacing - sm);
}

.contact - info - card,
.contact - calendly - card,
.contact - process - card {
    background: var(--color - white);
    border - radius: var(--border - radius - lg);
    padding: var(--spacing - md);
    border: 1px solid var(--color - border);
    margin - bottom: var(--spacing - md);
}

.contact - info - card h3,
.contact - calendly - card h3,
.contact - process - card h3 {
    font - size: 1rem;
    font - weight: 700;
    color: var(--color - primary);
    margin - bottom: var(--spacing - md);
}

.contact - info - item {
    display: flex;
    gap: var(--spacing - sm);
    margin - bottom: var(--spacing - sm);
    align - items: flex - start;
}

.contact - info - icon {
    font - size: 1.2rem;
    flex - shrink: 0;
}

.contact - info - item strong {
    display: block;
    font - size: 0.85rem;
    font - weight: 700;
    color: var(--color - text);
    margin - bottom: 0.25rem;
}

.contact - info - item p {
    font - size: 0.85rem;
    color: var(--color - text - light);
    margin: 0;
}

.contact - calendly - card p {
    font - size: 0.9rem;
    color: var(--color - text - light);
    margin - bottom: var(--spacing - sm);
}

.contact - calendly - note {
    font - size: 0.75rem!important;
    color: var(--color - text - light)!important;
    text - align: center;
    margin - top: 0.5rem!important;
}

.process - step {
    display: flex;
    gap: var(--spacing - sm);
    margin - bottom: var(--spacing - sm);
    align - items: flex - start;
}

.process - number {
    width: 28px;
    height: 28px;
    background: var(--color - primary);
    color: var(--color - white);
    border - radius: 50 %;
    display: flex;
    align - items: center;
    justify - content: center;
    font - size: 0.8rem;
    font - weight: 700;
    flex - shrink: 0;
}

.process - step strong {
    display: block;
    font - size: 0.9rem;
    font - weight: 700;
    margin - bottom: 0.2rem;
}

.process - step p {
    font - size: 0.82rem;
    color: var(--color - text - light);
    margin: 0;
}

/* ---------- Portal Login Page ---------- */
.portal - login - section {
    min - height: 100vh;
    background: var(--color - bg);
    padding - top: var(--nav - height);
    display: flex;
    align - items: center;
}

.portal - login - container {
    max - width: var(--container - max);
    margin: 0 auto;
    padding: var(--spacing - lg) var(--spacing - md);
    display: grid;
    grid - template - columns: 1fr 1fr;
    gap: var(--spacing - lg);
    align - items: start;
    width: 100 %;
}

.portal - login - card {
    background: var(--color - white);
    border - radius: var(--border - radius - lg);
    padding: var(--spacing - lg);
    box - shadow: var(--shadow);
    border: 1px solid var(--color - border);
}

.portal - logo {
    display: flex;
    align - items: center;
    gap: 0.5rem;
    margin - bottom: var(--spacing - lg);
    justify - content: center;
}

.portal - login - card h2 {
    font - size: 1.5rem;
    font - weight: 700;
    color: var(--color - primary);
    margin - bottom: 0.5rem;
    text - align: center;
}

.portal - login - card > div > p {
    color: var(--color - text - light);
    text - align: center;
    margin - bottom: var(--spacing - md);
    font - size: 0.9rem;
}

.portal - form - options {
    display: flex;
    justify - content: space - between;
    align - items: center;
    margin - bottom: var(--spacing - sm);
}

.portal - remember {
    display: flex;
    align - items: center;
    gap: 0.5rem;
    font - size: 0.85rem;
    cursor: pointer;
}

.portal - forgot {
    font - size: 0.85rem;
    color: var(--color - primary);
}

.portal - no - account {
    text - align: center;
    margin - top: var(--spacing - md);
    padding - top: var(--spacing - md);
    border - top: 1px solid var(--color - border);
}

.portal - no - account p {
    font - size: 0.85rem;
    color: var(--color - text - light);
    margin - bottom: 0.25rem;
}

.portal - info {
    padding: var(--spacing - md);
}

.portal - info h3 {
    font - size: 1.3rem;
    font - weight: 700;
    color: var(--color - primary);
    margin - bottom: var(--spacing - md);
}

.portal - feature {
    display: flex;
    gap: var(--spacing - sm);
    margin - bottom: var(--spacing - md);
    align - items: flex - start;
}

.portal - feature - icon {
    font - size: 1.5rem;
    flex - shrink: 0;
}

.portal - feature strong {
    display: block;
    font - weight: 700;
    color: var(--color - text);
    margin - bottom: 0.25rem;
}

.portal - feature p {
    font - size: 0.9rem;
    color: var(--color - text - light);
    margin: 0;
}

.portal - coming - soon {
    margin - top: var(--spacing - md);
    padding: var(--spacing - sm);
    background: rgba(243, 156, 18, 0.1);
    border - radius: var(--border - radius);
    border: 1px solid rgba(243, 156, 18, 0.3);
}

.portal - coming - soon p {
    font - size: 0.85rem;
    color: #856404;
}

.dashboard - header {
    display: flex;
    justify - content: space - between;
    align - items: center;
    margin - bottom: var(--spacing - md);
}

.dashboard - header h2 {
    font - size: 1.3rem;
    font - weight: 700;
    color: var(--color - primary);
}

.dashboard - stats {
    display: grid;
    grid - template - columns: repeat(3, 1fr);
    gap: var(--spacing - sm);
    margin - bottom: var(--spacing - md);
}

.dashboard - stat {
    background: var(--color - bg);
    border - radius: var(--border - radius);
    padding: var(--spacing - sm);
    text - align: center;
    border: 1px solid var(--color - border);
}

.dashboard - stat.stat - number {
    font - size: 1.8rem;
    color: var(--color - primary);
}

.dashboard - stat.stat - label {
    font - size: 0.75rem;
    color: var(--color - text - light);
}

.activity - list {
    padding: var(--spacing - sm);
    background: var(--color - bg);
    border - radius: var(--border - radius);
    min - height: 100px;
}

.no - activity {
    text - align: center;
    color: var(--color - text - light);
    font - size: 0.9rem;
    padding: var(--spacing - sm) 0;
}

/* ---------- Responsive additions ---------- */
@media(max - width: 1024px) {
  .service - detail - grid,
  .founder - grid {
        grid - template - columns: 1fr;
    }

  .expertise - grid {
        grid - template - columns: repeat(2, 1fr);
    }

  .commitment - grid {
        grid - template - columns: repeat(2, 1fr);
    }

  .contact - grid {
        grid - template - columns: 1fr;
    }

  .portal - login - container {
        grid - template - columns: 1fr;
        max - width: 500px;
    }

  .portal - info {
        display: none;
    }
}

@media(max - width: 768px) {
  .form - row {
        grid - template - columns: 1fr;
    }

  .expertise - grid {
        grid - template - columns: 1fr;
    }

  .commitment - grid {
        grid - template - columns: 1fr 1fr;
    }

  .dashboard - stats {
        grid - template - columns: 1fr;
    }
}