// Записывает релиз оболочки в историю платформы: downloads/<platform>.json.
//
// Портал ничего не опрашивает. Workflow оболочки присылает repository_dispatch
// с готовыми данными: версия, тег, прямая ссылка на файл в релизе портала.
// Здесь только запись в файл: latest, последний мажор и полная история со ссылками.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/** Сравнение версий X.Y.Z численно. */
function cmp(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** @param {Record<string, any>} e */
function snapshot(e) {
  return { version: e.version, tag: e.tag, url: e.url, size: e.size ?? null, date: e.date, notes: e.notes || [] };
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

/** @type {any[]} */
const releases = Array.isArray(base.releases) ? base.releases : [];

const entry = {
  version: String(p.version),
  tag: String(p.tag),
  url: String(p.url),
  size: Number.isFinite(Number(p.size)) ? Number(p.size) : null,
  date: p.date || today,
  major: p.major === true,
  notes: Array.isArray(p.notes) ? p.notes.filter(Boolean).slice(0, 12) : [],
};

// версия уже была — перезаписываем, иначе добавляем; история не копится дублями
const rest = releases.filter((r) => r.version !== entry.version);
rest.push(entry);
rest.sort((a, b) => cmp(b.version, a.version));

const previousMajor = base.major || null;

/** @type {Record<string, any>} */
const doc = {
  schema: 1,
  platform: p.platform,
  title: p.title || base.title || p.platform,
  repo: p.repo || base.repo || null,
  updated: today,
  latest: snapshot(entry),
  major: previousMajor,
  releases: rest,
};

// последний мажор: явный релиз мажора, иначе самый старший известный
if (entry.major) {
  doc.major = snapshot(entry);
} else if (!doc.major) {
  const top = rest.find((r) => cmp(doc.latest.version, r.version) <= 0) || entry;
  doc.major = snapshot({ ...top, date: top.date || today });
} else if (cmp(doc.latest.version, doc.major.version) < 0) {
  // latest откатился ниже мажора — мажор должен быть не ниже latest
  doc.major = snapshot(entry);
}

writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
console.log(file + ': latest ' + doc.latest.version + ', мажор ' + doc.major.version + ', всего релизов ' + rest.length);
