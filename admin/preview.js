// Предпросмотр статьи в админке: та же вёрстка (js/article.js) и те же стили, что на сайте.
// Обновляется прямо во время набора.
import { createRenderer } from '/js/article.js';

const { CMS, marked } = window;
const h = CMS.React.createElement;

marked.use({ breaks: true });

CMS.registerPreviewStyle('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700&display=swap&subset=cyrillic');
CMS.registerPreviewStyle('/css/style.css');
CMS.registerPreviewStyle('.article { padding-top: 32px; }', { raw: true });

const toPlain = (value) => (value && typeof value.toJS === 'function' ? value.toJS() : value || {});

function ArticlePreview({ entry, getAsset }) {
  const data = toPlain(entry.getIn(['data']));
  const { article } = createRenderer({
    parse: (s) => marked.parse(s),
    parseInline: (s) => marked.parseInline(s),
    // Ещё не сохранённые картинки показываются из памяти браузера
    asset: (src) => {
      try { return getAsset(src)?.url || src; } catch { return src; }
    },
  });
  return h('main', { id: 'main' }, h('article', { className: 'article', dangerouslySetInnerHTML: { __html: article(data) } }));
}

CMS.registerPreviewTemplate('articles', ArticlePreview);
