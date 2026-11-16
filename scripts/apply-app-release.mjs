// Записывает мини-приложение в catalog.json по данным из его репозитория.
//
// Одна версия — одна запись; «latest» — самая новая версия в каталоге.
// Ссылка ведёт на конкретный тег vX.Y.Z, поэтому не ломается при следующем релизе.
// Портал не ходит в репозитории мини-приложений: релизы живут там, здесь только запись.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function cmp(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

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

const latest = p.version && p.version.latest;
if (!latest || !latest.v) {
  console.error('в PAYLOAD нет version.latest.v');
  process.exit(1);
}

/** @type {Record<string, any>} */
const catalog = existsSync('catalog.json')
  ? JSON.parse(readFileSync('catalog.json', 'utf8'))
  : { schema: 1, apps: [] };
/** @type {any[]} */
const apps = Array.isArray(catalog.apps) ? catalog.apps : [];
const today = new Date().toISOString().slice(0, 10);

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
    v: String(latest.v),
    url: latest.url ? String(latest.url) : null,
  },
  repo: p.repo || null,
  updated: today,
};

// история версий: новая версия перезаписывает свою запись, старые не теряются
/** @type {any[]} */
const prev = apps.find((a) => a.id === record.id);
const versions = Array.isArray(prev && prev.versions) ? prev.versions.filter((x) => x.v !== record.version.v) : [];
versions.push({ v: record.version.v, url: record.version.url, date: today });
versions.sort((a, b) => cmp(b.v, a.v));
record.versions = versions;

const rest = apps.filter((a) => a.id !== record.id);
rest.push(record);
rest.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));

writeFileSync('catalog.json', JSON.stringify({ schema: 1, updated: today, apps: rest }, null, 2) + '\n');
console.log('catalog.json: ' + record.id + ' v' + record.version.v + ', версий ' + versions.length + ', всего приложений ' + rest.length);
