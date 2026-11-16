// Записывает релиз оболочки в историю платформы: downloads/<platform>.json.
//
// Схема релизов обычная: одна версия — один релиз с тегом vX.Y.Z.
// «latest» — это самый новый релиз (встроенный механизм GitHub), отдельного плавающего
// релиза и отдельного мажорного нет. Портал ничего не опрашивает: оболочка присылает
// готовые данные, здесь только запись в историю.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/** Численное сравнение версий X.Y.Z; >0, если a новее b. */
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
  console.error('PAYLOAD пуст: нет данных из workflow оболочки');
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

for (const key of ['platform', 'version', 'tag', 'url']) {
  if (!p[key]) {
    console.error('в PAYLOAD нет поля ' + key);
    process.exit(1);
  }
}

const file = 'downloads/' + p.platform + '.json';
mkdirSync('downloads', { recursive: true });

/** @type {Record<string, any>} */
const base = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const today = new Date().toISOString().slice(0, 10);

const record = {
  version: String(p.version),
  tag: String(p.tag),
  url: String(p.url),
  size: Number.isFinite(Number(p.size)) ? Number(p.size) : null,
  date: p.date || today,
  notes: Array.isArray(p.notes) ? p.notes.filter(Boolean).slice(0, 12) : [],
};

/** @type {any[]} */
const prev = Array.isArray(base.releases) ? base.releases : [];
// одна версия — одна запись; повторный релиз той же версии перезаписывает её
const rest = prev.filter((r) => r.version !== record.version);
rest.push(record);
rest.sort((a, b) => cmp(b.version, a.version));

/** @type {Record<string, any>} */
const doc = {
  schema: 2,
  platform: p.platform,
  title: p.title || base.title || p.platform,
  repo: p.repo || base.repo || null,
  updated: today,
  latest: rest[0],
  releases: rest,
};

writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
console.log(file + ': latest ' + doc.latest.version + ', всего версий ' + rest.length);
