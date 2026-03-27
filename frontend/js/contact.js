/* ============================================
   VNK Automatisation Inc. - Contact Form
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submit-btn');
    const feedback = document.getElementById('form-feedback');

    // Disable button during submission
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Envoi en cours...</span>';

    const formData = {
      name: document.getElementById('name').value,
      company: document.getElementById('company').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      service: document.getElementById('service').value,
      plc_brand: document.getElementById('plc-brand').value,
      message: document.getElementById('message').value
    };

    try {
      // Send to backend API
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        feedback.className = 'alert alert-success';
        feedback.textContent = 'Message envoyé avec succès. Nous vous répondrons dans les 24 heures.';
        feedback.style.display = 'block';
        form.reset();
      } else {
        throw new Error('Server error');
      }
    } catch (error) {
      // Fallback — show success anyway in dev mode
      feedback.className = 'alert alert-info';
      feedback.textContent = 'Message reçu. Backend en cours de développement — contactez-nous directement à vnkautomatisation@gmail.com';
      feedback.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span data-i18n="contact.form.submit">Envoyer le message</span>';
    }
  });
});