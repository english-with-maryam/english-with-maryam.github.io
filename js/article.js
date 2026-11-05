// Вёрстка статьи из блоков. Общая для сборки сайта (build.js) и предпросмотра в админке (admin/preview.js),
// поэтому предпросмотр выглядит ровно как страница на сайте.
//
// createRenderer({ parse, parseInline, dims, asset }):
//   parse / parseInline — Markdown → HTML (marked);
//   dims(src) — строка ` width=".." height=".."` или '';
//   asset(src) — адрес картинки для показа (в админке — ещё не сохранённые файлы).

export const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Неразрывный пробел после коротких русских слов, только в тексте (не внутри тегов)
const SHORT = 'в|во|и|с|со|к|ко|о|об|у|а|не|ни|но|на|по|за|из|от|до|для|без|при|про|их|же|бы|ли|я|мы|он|то';
const shortRe = new RegExp(`(^|[\\s(«„"—])(${SHORT})\\s+(?=\\S)`, 'gi');
export const typo = (html) => html.replace(/>([^<]+)</g, (m, text) => '>' + text.replace(shortRe, '$1$2 ') + '<');
export const typoText = (s) => typo('>' + s + '<').slice(1, -1);

// Одиночные блоки, которые после «шага» уходят внутрь него
const STEP_CHILDREN = new Set(['text', 'list', 'examples', 'compare', 'callout']);

export function createRenderer({ parse, parseInline, dims = () => '', asset = (src) => src }) {
  const md = (s = '') => typo(parse(String(s).trim()));
  const mdInline = (s = '') => typo('>' + parseInline(String(s).trim()) + '<').slice(1, -1);
  const imgTag = (src, alt, extra = '') => `<img src="${esc(asset(src))}"${dims(src)} alt="${esc(alt)}"${extra}>`;

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
        return `<figure>\n        ${imgTag(b.src, b.alt || b.caption || '', ` loading="lazy"${style}`)}${cap}\n      </figure>`;
      }
      case 'gallery': {
        const imgs = (b.images || []).filter((i) => i && i.src);
        if (!imgs.length) return '';
        const n = Math.min(imgs.length, 4);
        const ar = n === 2 ? '2 / 3' : '3 / 4';
        const cap = b.caption ? `\n        <figcaption>${mdInline(b.caption)}</figcaption>` : '';
        return `<figure class="gallery" style="--n:${n};--ar:${ar}">\n        <div class="gallery__row">\n${imgs
          .map((i) => `          ${imgTag(i.src, i.alt || b.caption || '', ' loading="lazy"')}`).join('\n')}\n        </div>${cap}\n      </figure>`;
      }
      case 'list': {
        const tag = b.numbered ? 'ol' : 'ul';
        return `<${tag}>\n${(b.items || []).filter(Boolean).map((i) => `        <li>${mdInline(i)}</li>`).join('\n')}\n      </${tag}>`;
      }
      case 'examples':
        return `<ul class="examples">\n${(b.items || []).filter(Boolean).map((i) =>
          `        <li><span class="en" lang="en">${esc(i.en)}</span><span>${typoText(esc(i.ru || ''))}</span></li>`).join('\n')}\n      </ul>`;
      case 'compare':
        return `<div class="compare" lang="en">\n${(b.pairs || []).filter(Boolean).map((p) =>
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
      if (!b) continue;
      if (b.type !== 'step') { out.push('      ' + block(b)); continue; }
      n += 1;
      const inner = [`<h2>${typoText(esc(b.title))}</h2>`];
      if (b.body) inner.push(md(b.body));
      while (blocks[i + 1] && STEP_CHILDREN.has(blocks[i + 1].type)) inner.push(block(blocks[++i]));
      out.push(`      <div class="step">\n        <span class="step__n">${n}</span>\n        <div>\n          ${inner.join('\n          ')}\n        </div>\n      </div>`);
    }
    return out.join('\n\n');
  }

  // Шапка статьи и блоки — содержимое <article class="article">
  const article = (a) => `
      <header class="article__head">
        <span class="eyebrow">${esc(a.category || 'Материалы')}</span>
        <h1>${typoText(esc(a.title || ''))}</h1>${a.lead ? `\n        <p class="article__lead">${typoText(esc(a.lead))}</p>` : ''}
      </header>

${body(a.blocks)}`;

  return { md, mdInline, imgTag, block, body, article };
}
