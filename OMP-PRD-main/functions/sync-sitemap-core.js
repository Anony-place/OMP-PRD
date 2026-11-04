#!/usr/bin/env node
/* Copy the shared sitemap core from the Supabase Edge Function into the
   Firebase Functions source directory.

   Firebase only uploads the `functions/` directory, so the Cloud Function
   cannot import straight out of `supabase/`. Rather than maintain two
   copies of the sitemap rules by hand (they would drift), the fallback
   path imports this generated copy. `tools/test_sitemap.js` fails if the
   two files ever diverge.

   Usage:  npm run sync:sitemap   (from inside functions/)
*/
'use strict';

const fs = require('fs');
const path = require('path');

const from = path.resolve(__dirname, '..', 'supabase', 'functions', 'sitemap', 'sitemap-core.mjs');
const to = path.resolve(__dirname, 'sitemap-core.mjs');

if (!fs.existsSync(from)) {
  console.error(`sync-sitemap-core: source not found: ${from}`);
  process.exit(1);
}

fs.copyFileSync(from, to);
console.log(`sync-sitemap-core: ${path.relative(process.cwd(), to)} updated from ${path.relative(process.cwd(), from)}`);
