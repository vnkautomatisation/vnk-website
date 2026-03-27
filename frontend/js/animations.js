/* ============================================
   VNK Automatisation Inc. - Animations
   ============================================ */

// ---------- Counter animation ----------
function animateCounter(element) {
  const target = parseInt(element.getAttribute('data-target'));
  const duration = 2000;
  const step = target / (duration / 16);
  let current = 0;

  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    element.textContent = Math.floor(current);
  }, 16);
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

// Observe all animated elements
document.addEventListener('DOMContentLoaded', () => {
  // Animate on scroll elements
  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });

  // Hero counters on load
  setTimeout(() => {
    document.querySelectorAll('.hero .counter').forEach(counter => {
      animateCounter(counter);
    });
  }, 800);

  // Hero fade-up animations
  document.querySelectorAll('.animate-fade-up').forEach((el, index) => {
    setTimeout(() => {
      el.classList.add('visible');
    }, 200 + (index * 150));
  });
});

// ---------- Parallax hero image ----------
window.addEventListener('scroll', () => {
  const heroImg = document.getElementById('hero-img');
  if (heroImg) {
    const scrolled = window.scrollY;
    heroImg.style.transform = `translateY(${scrolled * 0.3}px)`;
  }
});