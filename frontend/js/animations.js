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

// ---------- Scroll animations ----------
const observerOptions = {
  threshold: 0.15,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');

      // Trigger counters
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

// Hero fade-up animations — force visible after 100ms
document.addEventListener('DOMContentLoaded', () => {
    // Force all hero elements visible immediately
    setTimeout(() => {
        document.querySelectorAll('.animate-fade-up').forEach(el => {
            el.classList.add('visible');
        });
    }, 100);

    // Scroll animations
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
    });

    // Hero counters
    setTimeout(() => {
        document.querySelectorAll('.hero .counter').forEach(counter => {
            animateCounter(counter);
        });
    }, 300);
});

// ---------- Parallax hero image ----------
window.addEventListener('scroll', () => {
  const heroImg = document.getElementById('hero-img');
  if (heroImg) {
    const scrolled = window.scrollY;
    heroImg.style.transform = `translateY(${scrolled * 0.3}px)`;
  }
});