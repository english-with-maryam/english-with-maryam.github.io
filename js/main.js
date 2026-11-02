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

// Высота подвала — чтобы блок контактов вместе с подвалом занимал один экран
const footer = document.querySelector('.footer');
if (footer && document.querySelector('.section--contact')) {
  const setFooterH = () => document.documentElement.style.setProperty('--footer-h', footer.offsetHeight + 'px');
  setFooterH();
  new ResizeObserver(setFooterH).observe(footer);
}

// Копирование адреса почты
document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement('textarea');
      t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
    }
    const label = btn.textContent;
    btn.textContent = 'Адрес скопирован ✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = label; btn.classList.remove('copied'); }, 2000);
  });
});

// Меню почты закрывается по клику мимо и по Esc
const mailpick = document.querySelector('.mailpick');
if (mailpick) {
  document.addEventListener('click', (e) => { if (!mailpick.contains(e.target)) mailpick.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') mailpick.open = false; });
}
