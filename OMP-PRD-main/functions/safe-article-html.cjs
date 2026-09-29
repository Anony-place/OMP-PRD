/* One parser-based allowlist for the static publisher and optional SSR fallback.
 * Never try to sanitize HTML/encoded URL schemes with regular expressions. */
const sanitize = require('sanitize-html');
module.exports = function safeArticleHTML(html) {
  return sanitize(String(html || ''), {
    allowedTags: ['p','h1','h2','h3','h4','h5','h6','ul','ol','li','strong','em','b','i','u','s','sup','sub','br','hr','pre','code','blockquote','a','img','table','thead','tbody','tfoot','tr','th','td','caption','figure','figcaption','details','summary','div','span'],
    allowedAttributes: {table:['tabindex'],a:['href','title','rel'],img:['src','alt','width','height','loading'],code:['class'],th:['colspan','rowspan','scope'],td:['colspan','rowspan'],ol:['start']},
    allowedClasses: {code:[/^language-[a-z0-9-]+$/]},
    allowedSchemes: ['https','http'],
    allowedSchemesByTag: {img:['https']},
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {table: sanitize.simpleTransform('table',{tabindex:'0'}),a: sanitize.simpleTransform('a',{rel:'noopener noreferrer'})},
  });
};
