// Собирает catalog.json: манифесты из sources.json плюс данные последнего релиза.
// Запускается по расписанию, вручную и по событию release из репозиториев приложений.
import { readFileSync, writeFileSync } from 'node:fs';
import { gh, changelog, pickAsset } from './lib.mjs';

const src = JSON.parse(readFileSync('sources.json', 'utf8'));
const apps = [];
const errors = [];

for (const s of src.apps) {
  try {
    const branch = s.branch || 'main';
    const file = await gh('https://api.github.com/repos/' + s.repo + '/contents/mapp/mapp.manifest.json?ref=' + branch);
    const m = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));

    /** @type {any} */
    let release = null;
    try {
      release = await gh('https://api.github.com/repos/' + s.repo + '/releases/latest');
    } catch { /* релиза ещё нет — берём версию из манифеста */ }

    const version = release ? release.tag_name.replace(/^v/, '') : m.version;
    const zip = release ? pickAsset(release, /\.zip$/i) : null;

    apps.push({
      id: m.id,
      name: m.name,
      author: m.author,
      version,
      description: m.description || '',
      url: s.pages.replace(/\/?$/, '/'),
      repo: 'https://github.com/' + s.repo,
      icon: s.icon || null,
      permissions: Array.isArray(m.permissions) ? m.permissions : [],
      manifest: s.pages.replace(/\/?$/, '/') + 'mapp.manifest.json',
      release: release ? release.html_url : null,
      archive: zip ? zip.browser_download_url : null,
      updated: release ? (release.published_at || '').slice(0, 10) : null,
      changelog: release ? changelog(release.body) : [],
    });
  } catch (err) {
    errors.push(s.repo + ': ' + err.message);
  }
}

apps.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));

writeFileSync('catalog.json', JSON.stringify({
  schema: 1,
  updated: new Date().toISOString().slice(0, 10),
  apps,
}, null, 2) + '\n');

console.log('каталог: ' + apps.length + ' приложений');
if (errors.length) console.warn('предупреждения:\n  ' + errors.join('\n  '));
if (!apps.length && errors.length) process.exit(1);
