// Мобильное меню
const burger = document.querySelector('.burger');
const nav = document.querySelector('.nav');
if (burger && nav) {
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });
}

// Просмотр сертификатов
const box = document.querySelector('.lightbox');
if (box) {
  const img = box.querySelector('img');
  const cap = box.querySelector('.lightbox__cap');
  document.querySelectorAll('[data-full]').forEach((btn) => {
    btn.addEventListener('click', () => {
      img.src = btn.dataset.full;
      img.alt = btn.querySelector('img').alt;
      cap.textContent = btn.querySelector('b').textContent;
      box.showModal();
    });
  });
  box.querySelector('.lightbox__close').addEventListener('click', () => box.close());
  box.addEventListener('click', (e) => { if (e.target === box) box.close(); });
}
