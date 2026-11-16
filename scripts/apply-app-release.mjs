// Записывает мини-приложение в catalog.json по данным из его репозитория.
//
// Репозиторий мини-приложения сам присылает упрощённый манифест:
// id, name, author, description, web, icon, manifest и версии latest/major со ссылками.
// Портал не ходит в репозитории мини-приложений: релизы живут там, здесь только запись.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const raw = process.env.PAYLOAD || '';
if (!raw) {
  console.error('PAYLOAD пуст: нет данных из репозитория мини-приложения');
  process.exit(1);
}

/** @type {Record<string, any>} */
let p;
try {
  p = JSON.parse(raw);
} catch (err) {
  console.error('PAYLOAD не разбирается как JSON: ' + err.message);
  process.exit(1);
}

for (const key of ['id', 'name', 'author']) {
  if (!p[key]) {
    console.error('в PAYLOAD нет поля ' + key);
    process.exit(1);
  }
}

const short = (o) => (o && o.v ? { v: String(o.v), url: o.url ? String(o.url) : null } : null);
const latest = short(p.version && p.version.latest);
if (!latest) {
  console.error('в PAYLOAD нет version.latest.v');
  process.exit(1);
}

/** @type {Record<string, any>} */
const catalog = existsSync('catalog.json')
  ? JSON.parse(readFileSync('catalog.json', 'utf8'))
  : { schema: 1, apps: [] };
/** @type {any[]} */
const apps = Array.isArray(catalog.apps) ? catalog.apps : [];

/** @type {Record<string, any>} */
const record = {
  id: p.id,
  name: p.name,
  author: p.author,
  description: p.description || '',
  web: p.web || null,
  url: p.web || null, // совместимость с текущим лаунчером
  icon: p.icon || null,
  manifest: p.manifest || null,
  permissions: Array.isArray(p.permissions) ? p.permissions : [],
  version: {
    major: short(p.version && p.version.major) || latest,
    latest,
  },
  repo: p.repo || null,
  updated: new Date().toISOString().slice(0, 10),
};

const rest = apps.filter((a) => a.id !== record.id);
rest.push(record);
rest.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));

writeFileSync('catalog.json', JSON.stringify({ schema: 1, updated: record.updated, apps: rest }, null, 2) + '\n');
console.log('catalog.json: ' + record.id + ' latest ' + latest.v + ', мажор ' + record.version.major.v + ', всего ' + rest.length);
