// Собирает catalog.json из sources.json: тянет mapp/mapp.manifest.json каждого репозитория
// и берёт последний релиз (если есть). Ошибки одного приложения не валят весь каталог.
import { readFileSync, writeFileSync } from 'node:fs';

const TOKEN = process.env.GITHUB_TOKEN || '';
const H = { 'User-Agent': 'miniapphub-sync', Accept: 'application/vnd.github+json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };

async function jget(url) {
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

const src = JSON.parse(readFileSync('sources.json', 'utf8'));
const apps = [];
const errors = [];

for (const s of src.apps) {
  try {
    const branch = s.branch || 'main';
    const manifest = await jget(`https://api.github.com/repos/${s.repo}/contents/mapp/mapp.manifest.json?ref=${branch}`);
    const m = JSON.parse(Buffer.from(manifest.content, 'base64').toString('utf8'));
    let version = m.version;
    let releaseUrl = null;
    try {
      const rel = await jget(`https://api.github.com/repos/${s.repo}/releases/latest`);
      version = rel.tag_name.replace(/^v/, '');
      releaseUrl = rel.html_url;
    } catch { /* релизов ещё нет — используем версию из манифеста */ }
    apps.push({
      id: m.id,
      name: m.name,
      author: m.author,
      version,
      description: m.description || '',
      url: s.pages,
      repo: `https://github.com/${s.repo}`,
      release: releaseUrl,
      permissions: m.permissions || [],
      manifest: `${s.pages.replace(/\/?$/, '/')}mapp.manifest.json`,
    });
  } catch (e) {
    errors.push(`${s.repo}: ${e.message}`);
  }
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync('catalog.json', JSON.stringify({ schema: 1, updated: today, apps }, null, 2) + '\n');
console.log(`каталог: ${apps.length} приложений`);
if (errors.length) console.warn('предупреждения:\n' + errors.join('\n'));
if (!apps.length && errors.length) process.exit(1);
