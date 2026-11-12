// Точечное обновление одной записи каталога по событию release.
// Не перезаписывает остальные записи — в отличие от полной синхронизации.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gh, changelog, pickAsset } from './lib.mjs';

const repo = process.argv[2];
if (!repo) {
  console.error('использование: node scripts/apply-release.mjs <owner/repo>');
  process.exit(1);
}

const src = JSON.parse(readFileSync('sources.json', 'utf8'));
const entry = src.apps.find((a) => a.repo === repo);
if (!entry) {
  console.error('в sources.json нет ' + repo);
  process.exit(0);
}

const release = await gh('https://api.github.com/repos/' + repo + '/releases/latest');
const manifest = await gh('https://api.github.com/repos/' + repo + '/contents/mapp/mapp.manifest.json?ref=' + (entry.branch || 'main'));
const m = JSON.parse(Buffer.from(manifest.content, 'base64').toString('utf8'));
const zip = pickAsset(release, /\.zip$/i);

/** @type {any} */
const catalog = existsSync('catalog.json')
  ? JSON.parse(readFileSync('catalog.json', 'utf8'))
  : { schema: 1, apps: [] };
catalog.apps = Array.isArray(catalog.apps) ? catalog.apps : [];

const record = {
  id: m.id,
  name: m.name,
  author: m.author,
  version: release.tag_name.replace(/^v/, ''),
  description: m.description || '',
  url: entry.pages.replace(/\/?$/, '/'),
  repo: 'https://github.com/' + repo,
  icon: entry.icon || null,
  permissions: Array.isArray(m.permissions) ? m.permissions : [],
  manifest: entry.pages.replace(/\/?$/, '/') + 'mapp.manifest.json',
  release: release.html_url,
  archive: zip ? zip.browser_download_url : null,
  updated: (release.published_at || '').slice(0, 10),
  changelog: changelog(release.body),
};

catalog.apps = catalog.apps.filter((a) => a.id !== record.id);
catalog.apps.push(record);
catalog.apps.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
catalog.schema = 1;
catalog.updated = new Date().toISOString().slice(0, 10);

writeFileSync('catalog.json', JSON.stringify(catalog, null, 2) + '\n');
console.log('обновлено: ' + record.id + '@' + record.version);
