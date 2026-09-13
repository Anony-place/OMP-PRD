import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const OLD_ORIGIN = 'https://oopsmypassword.com';
const NEW_ORIGIN = 'https://oopsmypassword.web.app';
const TEXT_EXTENSIONS = new Set([
  '.html', '.js', '.css', '.json', '.xml', '.txt', '.webmanifest', '.md', '.mjs', '.py'
]);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'functions', 'supabase', 'tools']);

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await walk(join(dir, entry.name));
      continue;
    }
    const path = join(dir, entry.name);
    const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    const source = await readFile(path, 'utf8');
    if (!source.includes(OLD_ORIGIN)) continue;
    await writeFile(path, source.replaceAll(OLD_ORIGIN, NEW_ORIGIN), 'utf8');
    console.log(`Updated site origin: ${path}`);
  }
}

await walk(ROOT);
console.log('Production site-origin normalization complete.');
