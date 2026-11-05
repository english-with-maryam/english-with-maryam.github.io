// Сборка сайта: статические файлы + страницы статей из content/articles/*.json → _site/
// Запуск: npm run build. На GitHub это делает .github/workflows/deploy.yml после каждого изменения.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { imageSize } from 'image-size';

const SITE = 'https://english-with-maryam.github.io';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, '_site');
const STATIC = ['index.html', '404.html', 'robots.txt', 'favicon.svg', 'css', 'js', 'img', 'admin'];
const VERSION = Date.now().toString(36);

marked.use({ breaks: true });

// ---------- утилиты ----------

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Неразрывный пробел после коротких русских слов, только в тексте (не внутри тегов)
const SHORT = 'в|во|и|с|со|к|ко|о|об|у|а|не|ни|но|на|по|за|из|от|до|для|без|при|про|их|же|бы|ли|я|мы|он|то';
const shortRe = new RegExp(`(^|[\\s(«„"—])(${SHORT})\\s+(?=\\S)`, 'gi');
const typo = (html) => html.replace(/>([^<]+)</g, (m, text) => '>' + text.replace(shortRe, '$1$2 ') + '<');
const typoText = (s) => typo('>' + s + '<').slice(1, -1);

const md = (s = '') => typo(marked.parse(String(s).trim()));
const mdInline = (s = '') => typo('>' + marked.parseInline(String(s).trim()) + '<').slice(1, -1);

const dims = (src) => {
  try {
    const { width, height } = imageSize(fs.readFileSync(path.join(ROOT, src.replace(/^\//, ''))));
    return ` width="${width}" height="${height}"`;
  } catch { return ''; }
};

const imgTag = (src, alt, extra = '') => `<img src="${esc(src)}"${dims(src)} alt="${esc(alt)}"${extra}>`;

const copy = (from, to) => {
  if (!fs.existsSync(from)) return;
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from)) copy(path.join(from, f), path.join(to, f));
  } else fs.copyFileSync(from, to);
};

const write = (rel, html) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
};

// Номер версии у css/js, чтобы браузеры сразу брали новые файлы
const bust = (html) => html
  .replace(/\/css\/style\.css(\?v=[\w]+)?"/g, `/css/style.css?v=${VERSION}"`)
  .replace(/\/js\/main\.js(\?v=[\w]+)?"/g, `/js/main.js?v=${VERSION}"`);

// ---------- статьи ----------

// Дата из админки без часового пояса — это время Тольятти (UTC+4)
const TZ = '+04:00';
const publishTime = (d) => {
  if (!d) return 0;
  const s = String(d);
  return Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : `${s.length === 16 ? s + ':00' : s}${TZ}`) || 0;
};

// Статьи с датой в будущем ждут своего часа: их подхватит сборка по расписанию
const all = fs.readdirSync(path.join(ROOT, 'content/articles'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content/articles', f), 'utf8')))
  .filter((a) => !a.draft && a.url && a.title);
const articles = all
  .filter((a) => publishTime(a.date) <= Date.now())
  .sort((a, b) => publishTime(b.date) - publishTime(a.date));
const scheduled = all.filter((a) => publishTime(a.date) > Date.now());

const firstImage = (a) => {
  for (const b of a.blocks || []) {
    if (b.type === 'image' && b.src) return { src: b.src, alt: b.alt };
    if (b.type === 'gallery' && b.images?.[0]?.src) return b.images[0];
  }
  return null;
};
const coverOf = (a) => (a.cover ? { src: a.cover, alt: a.cover_alt || a.title } : firstImage(a));
const shortTitle = (a) => a.short_title || a.title;
const href = (a) => `/materialy/${a.url}/`;

// Одиночные блоки, которые после «шага» уходят внутрь него
const STEP_CHILDREN = new Set(['text', 'list', 'examples', 'compare', 'callout']);

function block(b) {
  switch (b.type) {
    case 'heading':
      return `<h2>${typoText(esc(b.text))}</h2>`;
    case 'text':
      return md(b.body);
    case 'image': {
      if (!b.src) return '';
      const shape = { landscape: '3 / 2', wide: '16 / 9' }[b.shape];
      const style = shape ? ` style="aspect-ratio:${shape};object-fit:cover"` : '';
      const cap = b.caption ? `\n        <figcaption>${mdInline(b.caption)}</figcaption>` : '';
      return `<figure>\n        ${imgTag(b.src, b.alt, ` loading="lazy"${style}`)}${cap}\n      </figure>`;
    }
    case 'gallery': {
      const imgs = (b.images || []).filter((i) => i.src);
      if (!imgs.length) return '';
      const n = Math.min(imgs.length, 4);
      const ar = n === 2 ? '2 / 3' : '3 / 4';
      const cap = b.caption ? `\n        <figcaption>${mdInline(b.caption)}</figcaption>` : '';
      return `<figure class="gallery" style="--n:${n};--ar:${ar}">\n        <div class="gallery__row">\n${imgs
        .map((i) => `          ${imgTag(i.src, i.alt, ' loading="lazy"')}`).join('\n')}\n        </div>${cap}\n      </figure>`;
    }
    case 'list': {
      const tag = b.numbered ? 'ol' : 'ul';
      return `<${tag}>\n${(b.items || []).filter(Boolean).map((i) => `        <li>${mdInline(i)}</li>`).join('\n')}\n      </${tag}>`;
    }
    case 'examples':
      return `<ul class="examples">\n${(b.items || []).map((i) =>
        `        <li><span class="en" lang="en">${esc(i.en)}</span><span>${typoText(esc(i.ru || ''))}</span></li>`).join('\n')}\n      </ul>`;
    case 'compare':
      return `<div class="compare" lang="en">\n${(b.pairs || []).map((p) =>
        `        <div class="bad">${esc(p.wrong)}</div><div class="good">${esc(p.right)}</div>`).join('\n')}\n      </div>`;
    case 'callout': {
      const title = b.title ? `\n        <span class="callout__title">${esc(b.title)}</span>` : '';
      return `<div class="callout">${title}\n        ${md(b.body)}\n      </div>`;
    }
    default:
      return '';
  }
}

function body(blocks = []) {
  const out = [];
  let n = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type !== 'step') { out.push('      ' + block(b)); continue; }
    n += 1;
    const inner = [`<h2>${typoText(esc(b.title))}</h2>`];
    if (b.body) inner.push(md(b.body));
    while (blocks[i + 1] && STEP_CHILDREN.has(blocks[i + 1].type)) inner.push(block(blocks[++i]));
    out.push(`      <div class="step">\n        <span class="step__n">${n}</span>\n        <div>\n          ${inner.join('\n          ')}\n        </div>\n      </div>`);
  }
  return out.join('\n\n');
}

// ---------- общие части страниц ----------

const head = ({ title, description, url, image, type = 'article', ld }) => `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} | My English Classroom</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${SITE}${url}">
  <meta name="theme-color" content="#fbf7f0">

  <meta property="og:type" content="${type}">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:site_name" content="My English Classroom">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${SITE}${url}">${image ? `\n  <meta property="og:image" content="${SITE}${esc(image)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">

  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700&display=swap&subset=cyrillic" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">

  <script type="application/ld+json">
${JSON.stringify(ld, null, 2).replace(/^/gm, '  ')}
  </script>
</head>
<body>
  <a class="skip" href="#main">Перейти к содержанию</a>
  <header class="header">
    <div class="wrap header__in">
      <a class="logo" href="/" aria-label="My English Classroom — на главную">
        <span class="logo__mark" aria-hidden="true">MEC</span>
        <span class="logo__text">My English Classroom<small>Английский с Марьям Айратовной</small></span>
      </a>
      <button class="burger" type="button" aria-label="Меню" aria-expanded="false" aria-controls="nav">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
      <nav class="nav" id="nav" aria-label="Основное меню">
        <a href="/#about">Обо мне</a>
        <a href="/#experience">Опыт</a>
        <a href="/#certificates">Сертификаты</a>
        <a href="/#materials" aria-current="page">Материалы</a>
        <a href="/#contact">Контакты</a>
      </nav>
    </div>
  </header>`;

const foot = `  <footer class="footer">
    <div class="wrap footer__in">
      <span>© ${new Date().getFullYear()} My English Classroom · Марьям Айратовна</span>
      <span>Преподаватель английского языка, <a href="https://ddut.tgl.ru/" target="_blank" rel="noopener">МБОУ ДО «ДДЮТ»</a></span>
    </div>
  </footer>
  <script src="/js/main.js" defer></script>
</body>
</html>
`;

const crumbs = (items) => `    <div class="wrap">
      <nav class="crumbs" aria-label="Навигационная цепочка">
        <ol>
${items.map(([name, url]) => url
    ? `          <li><a href="${url}">${esc(name)}</a></li>`
    : `          <li aria-current="page">${esc(name)}</li>`).join('\n')}
        </ol>
      </nav>
    </div>`;

const crumbsLd = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({
    '@type': 'ListItem', position: i + 1, name, ...(url ? { item: SITE + url } : {}),
  })),
});

const card = (a, h = 'h3', lazy = true) => {
  const c = coverOf(a);
  return `          <a class="card" href="${href(a)}">
            ${c ? imgTag(c.src, c.alt, lazy ? ' loading="lazy"' : '') : ''}
            <div class="card__body">
              <span class="card__tag">${esc(a.category || 'Материалы')}</span>
              <${h}${h === 'h2' ? ' style="font-size:1.25rem"' : ''}>${typoText(esc(shortTitle(a)))}</${h}>
              <p>${typoText(esc(a.summary || ''))}</p>
              <span class="card__more">Читать →</span>
            </div>
          </a>`;
};

// ---------- сборка ----------

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of STATIC) copy(path.join(ROOT, f), path.join(OUT, f));

// Страницы статей
for (const a of articles) {
  const c = coverOf(a);
  const description = a.seo_description || a.summary || a.lead || '';
  const bc = [['Главная', '/'], ['Материалы', '/materialy/'], [shortTitle(a)]];
  const more = articles.filter((x) => x !== a).slice(0, 3);
  const html = head({
    title: a.seo_title || a.title, description, url: href(a), image: c?.src,
    ld: {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'Article', headline: a.title, description, ...(c ? { image: SITE + c.src } : {}),
        inLanguage: 'ru', datePublished: a.date,
        author: { '@id': `${SITE}/#maryam`, '@type': 'Person', name: 'Марьям Айратовна' },
        mainEntityOfPage: SITE + href(a),
      }, crumbsLd(bc)],
    },
  }) + `
  <main id="main">
${crumbs(bc)}

    <article class="article">
      <header class="article__head">
        <span class="eyebrow">${esc(a.category || 'Материалы')}</span>
        <h1>${typoText(esc(a.title))}</h1>${a.lead ? `\n        <p class="article__lead">${typoText(esc(a.lead))}</p>` : ''}
      </header>

${body(a.blocks)}
${more.length ? `
      <aside class="more">
        <h2>Читайте также</h2>
        <ul>
${more.map((x) => `          <li><a href="${href(x)}">${esc(x.title)}</a></li>`).join('\n')}
        </ul>
      </aside>` : ''}
    </article>
  </main>
${foot}`;
  write(`materialy/${a.url}/index.html`, bust(html));
}

// Список всех материалов
{
  const bc = [['Главная', '/'], ['Материалы']];
  const html = head({
    title: 'Материалы по английскому языку: советы, грамматика, культура',
    description: 'Материалы преподавателя английского языка ДДЮТ Тольятти: советы, грамматика, культура и особенности языка.',
    url: '/materialy/', image: coverOf(articles[0] || {})?.src, type: 'website',
    ld: { '@context': 'https://schema.org', ...crumbsLd(bc) },
  }) + `
  <main id="main">
${crumbs(bc)}

    <section class="section" style="padding-top:32px">
      <div class="wrap">
        <div class="section__head">
          <span class="eyebrow">Материалы</span>
          <h1>Материалы по английскому языку</h1>
          <p>${typoText('Методические разработки, советы и интересные задания для тех, кто изучает английский, — детей, родителей и коллег.')}</p>
        </div>
        <div class="cards">
${articles.map((a, i) => card(a, 'h2', i > 2)).join('\n')}
        </div>
      </div>
    </section>
  </main>
${foot}`;
  write('materialy/index.html', bust(html));
}

// Главная: три последние статьи
{
  const tpl = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const cards = `        <div class="cards">\n${articles.slice(0, 3).map((a) => card(a)).join('\n')}\n        </div>`;
  write('index.html', bust(tpl.replace('        <!--LATEST_CARDS-->', cards)));
  write('404.html', bust(fs.readFileSync(path.join(ROOT, '404.html'), 'utf8')));
}

// Карта сайта
{
  const today = new Date().toISOString().slice(0, 10);
  const urls = [['/', today], ['/materialy/', today], ...articles.map((a) => [href(a), String(a.date || today).slice(0, 10)])];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `  <url><loc>${SITE}${u}</loc><lastmod>${d}</lastmod></url>`).join('\n')}
</urlset>
`);
}

console.log(`Готово: ${articles.length} статей → _site/`);
for (const a of scheduled) console.log(`Запланирована: ${a.url} на ${a.date} (Тольятти)`);
