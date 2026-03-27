/* ============================================
   VNK Automatisation Inc. - Animations
   ============================================ */

// ---------- Counter animation ----------
function animateCounter(element) {
    const target = parseInt(element.getAttribute('data-target'));
    const duration = 1500;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = Math.floor(eased * target);
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target;
        }
    }
    requestAnimationFrame(update);
}

// ---------- Scroll observer ----------
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -30px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            const counters = entry.target.querySelectorAll('.counter');
            counters.forEach(counter => {
                if (!counter.classList.contains('counted')) {
                    counter.classList.add('counted');
                    animateCounter(counter);
                }
            });
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// ---------- Init ----------
// Force hero visible immédiatement — pas d'attente
document.querySelectorAll('.animate-fade-up').forEach(el => {
    el.classList.add('visible');
});

// Hero counters
document.querySelectorAll('.hero .counter').forEach(counter => {
    animateCounter(counter);
});

// Scroll animations pour le reste de la page
document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
});