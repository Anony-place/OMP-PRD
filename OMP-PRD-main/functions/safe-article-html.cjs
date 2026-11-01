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
  /* foreignObject is the SVG escape hatch for HTML inside a drawing. sanitize-html
     drops the tag but keeps its children, which leaves stray HTML inside <svg>
     where it renders as nothing. Remove the whole element first - the sanitiser
     then never sees it. */
  html = String(html).replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '');
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

const BASE_ATTRS = {table:['tabindex'],a:['href','title','rel','class'],img:['src','alt','width','height','loading'],code:['class'],th:['colspan','rowspan','scope'],td:['colspan','rowspan'],ol:['start'],div:['class'],section:['class'],p:['class']};
/* Author ids (strict shape is enforced by the live renderer; here the
 * library safely escapes any value, and an id alone cannot execute). */
const TAGS_WITH_ID = ['p','h1','h2','h3','h4','h5','h6','ul','ol','li','div','span','figure','figcaption','details','summary','dl','dt','dd','table','video','audio','section','article'];
/* Presentation attributes are shared by every SVG shape. Deliberately absent:
   href/xlink:href (external references and script vectors), style (CSS can
   escape the drawing in old parsers), and any on* handler. */
const SVG_PRESENTATIONAL = ['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','stroke-opacity','opacity','transform','class','id'];
const SVG_GEOMETRY = ['d','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','width','height','points','offset','stop-color','stop-opacity','font-size','font-family','font-weight','text-anchor','dominant-baseline','dx','dy'];
const allowedAttributes = Object.assign({}, BASE_ATTRS, {
  video:['src','controls','loop','muted','poster','preload'],
  audio:['src','controls','loop','muted','preload'],
  source:['src','type'],
  track:['src','kind','srclang','label'],
  svg: ['xmlns','viewBox','preserveAspectRatio','role','aria-label','aria-hidden','width','height','class','id'],
  lineargradient: ['x1','y1','x2','y2','gradientUnits','gradientTransform','id'].concat(SVG_PRESENTATIONAL),
  radialgradient: ['cx','cy','r','fx','fy','gradientUnits','gradientTransform','id'].concat(SVG_PRESENTATIONAL),
  stop: ['offset','stop-color','stop-opacity'],
  marker: ['markerWidth','markerHeight','refX','refY','orient','markerUnits','id'],
  text: SVG_PRESENTATIONAL.concat(SVG_GEOMETRY)
});
for (const shape of ['g','path','rect','circle','ellipse','line','polyline','polygon','defs','tspan','title','desc']) {
  allowedAttributes[shape] = SVG_PRESENTATIONAL.concat(SVG_GEOMETRY);
}
for (const t of TAGS_WITH_ID) {
  allowedAttributes[t] = (allowedAttributes[t] || []).concat(['id']);
}

module.exports = function safeArticleHTML(html) {
  return sanitize(convertEmbeds(html), {
    /* This list and assets/js/sanitize.js must agree: the editor preview and the
       published page are the same bytes or the preview is a lie. The parity test
       in tools/test_richtext_parity.mjs fails the build when they drift.
       dl/dt/dd, kbd, mark, abbr, cite, q, ins, del, samp and small were accepted
       by the preview and silently unwrapped here - which is exactly the "it
       looked right in the editor" bug. */
    allowedTags: ['p','h1','h2','h3','h4','h5','h6','ul','ol','li','strong','em','b','i','u','s','sup','sub','br','hr','pre','code','blockquote','a','img','table','thead','tbody','tfoot','tr','th','td','caption','colgroup','col','figure','figcaption','details','summary','div','span','video','audio','source','track','section','article','dl','dt','dd','mark','kbd','abbr','cite','q','ins','del','samp','small','dfn','strike',
                  /* Inline diagrams. Everything here is a drawing primitive: no
                     <script>, no <style>, no <foreignObject>, no <use> with an
                     external href, no SMIL animation. Those are the vectors that
                     make SVG the classic mXSS carrier, and a diagram does not
                     need any of them. */
                  'svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','lineargradient','radialgradient','stop','marker','title','desc'],
    allowedAttributes,
    allowedClasses: {
      code: [/^language-[a-z0-9-]+$/],
      a: ['download', 'btn', 'btn-primary', 'btn-secondary', 'btn-sm'],
      div: ['notice', 'callout', 'callout-info', 'callout-warn', 'callout-tip'],
      section: ['book'],
      p: ['small', 'lead', 'notice']
    },
    allowedSchemes: ['https','http'],
    allowedSchemesByTag: {img:['https'],video:['https','http'],audio:['https','http'],source:['https','http']},
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    /* foreignObject is the classic SVG escape hatch: HTML interpretation inside
       a drawing. Dropping the tag but keeping its children put an <img> inside
       <svg> where it renders as nothing and confuses every later pass. Its
       content goes with it. */
    nonTextTags: ['style','script','textarea','option','noscript','foreignobject','template'],
    /* SVG attribute names are case-sensitive: lowercasing viewBox produces a
       drawing that silently collapses to 0x0. */
    parser: { lowerCaseAttributeNames: false },
    /* Mirror of the live renderer's guard: media whose src was rejected
       must not survive as an empty element. */
    exclusiveFilter: (frame) => (frame.tag === 'video' || frame.tag === 'audio' || frame.tag === 'source') && !frame.attribs.src,
    transformTags: {table: sanitize.simpleTransform('table',{tabindex:'0'}),a: sanitize.simpleTransform('a',{rel:'noopener noreferrer'})},
  });
};
