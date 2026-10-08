/* One parser-based allowlist for the static publisher and optional SSR fallback.
 * Never try to sanitize HTML/encoded URL schemes with regular expressions.
 *
 * Parity contract with assets/js/sanitize.js (the live renderer): both
 * allow the same tags. In particular video/audio/source/track survive in
 * both, author ids survive in both, and recognized video iframes become a
 * safe thumbnail link in both — anything else framed is dropped. The admin
 * live preview and the deployed page can therefore never disagree about
 * what a pasted embed turns into. */
const sanitize = require('sanitize-html');

/* Same conversion as OMPSanitize's embedLink(): a YouTube/Vimeo frame
 * becomes a plain outbound link (thumbnail for YouTube), so no
 * third-party frame ever ships on our pages. Runs BEFORE sanitize-html;
 * the produced markup still passes through the full allowlist below. */
function convertEmbeds(html) {
  return String(html || '')
    .replace(/<iframe\b[^>]*?src=(["'])(.*?)\1[^>]*?(?:\/>|>[\s\S]*?<\/iframe>)/gi, (m, _q, src) => {
      const yt = String(src).match(/(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=)([A-Za-z0-9_-]{6,20})/);
      if (yt) {
        return `<a href="https://www.youtube.com/watch?v=${yt[1]}" target="_blank" rel="noopener noreferrer nofollow"><img src="https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg" alt="Watch on YouTube" loading="lazy"><span> &#9654; Watch on YouTube</span></a>`;
      }
      const vimeo = String(src).match(/vimeo\.com\/(?:video\/)?(\d{5,12})/);
      if (vimeo) {
        return `<a href="https://vimeo.com/${vimeo[1]}" target="_blank" rel="noopener noreferrer nofollow">&#9654; Watch on Vimeo</a>`;
      }
      return '';
    });
}

const BASE_ATTRS = {table:['tabindex'],a:['href','title','rel'],img:['src','alt','width','height','loading'],code:['class'],th:['colspan','rowspan','scope'],td:['colspan','rowspan'],ol:['start']};
/* Author ids (strict shape is enforced by the live renderer; here the
 * library safely escapes any value, and an id alone cannot execute). */
const TAGS_WITH_ID = ['p','h1','h2','h3','h4','h5','h6','ul','ol','li','div','span','figure','figcaption','details','summary','dl','dt','dd','table','video','audio','section','article'];
const allowedAttributes = Object.assign({}, BASE_ATTRS, {
  video:['src','controls','loop','muted','poster','preload'],
  audio:['src','controls','loop','muted','preload'],
  source:['src','type'],
  track:['src','kind','srclang','label']
});
for (const t of TAGS_WITH_ID) {
  allowedAttributes[t] = (allowedAttributes[t] || []).concat(['id']);
}

module.exports = function safeArticleHTML(html) {
  return sanitize(convertEmbeds(html), {
    allowedTags: ['p','h1','h2','h3','h4','h5','h6','ul','ol','li','strong','em','b','i','u','s','sup','sub','br','hr','pre','code','blockquote','a','img','table','thead','tbody','tfoot','tr','th','td','caption','figure','figcaption','details','summary','div','span','video','audio','source','track'],
    allowedAttributes,
    allowedClasses: {code:[/^language-[a-z0-9-]+$/]},
    allowedSchemes: ['https','http'],
    allowedSchemesByTag: {img:['https'],video:['https','http'],audio:['https','http'],source:['https','http']},
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    /* Mirror of the live renderer's guard: media whose src was rejected
       must not survive as an empty element. */
    exclusiveFilter: (frame) => (frame.tag === 'video' || frame.tag === 'audio' || frame.tag === 'source') && !frame.attribs.src,
    transformTags: {table: sanitize.simpleTransform('table',{tabindex:'0'}),a: sanitize.simpleTransform('a',{rel:'noopener noreferrer'})},
  });
};
