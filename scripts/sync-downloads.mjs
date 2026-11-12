// Собирает downloads/<client>.json и downloads/files/ из плавающего релиза "latest".
//
// Оболочки публикуют файлы в релиз с фиксированным тегом latest: он один и обновляется
// при любой смене версии. Поэтому версию нельзя брать из tag_name — он всегда "latest".
// Источник истины — строка `version: X.Y.Z` в теле релиза (её пишет workflow оболочки).
// Запасной вариант — разбор версии из имени файла-ассета.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { gh, changelog, pickAsset } from './lib.mjs';

/** Описание клиентов: репозиторий, заголовок, платформа и какой файл считать установщиком. */
const CLIENTS = [
  {
    repo: 'MiniAppHub/appshell-mobile',
    name: 'appshell-mobile',
    title: 'Android',
    platform: 'Android · APK',
    file: /\.apk$/i,
    ext: '.apk',
  },
  {
    repo: 'MiniAppHub/appshell-desktop',
    name: 'appshell-desktop',
    title: 'Windows',
    platform: 'Windows · MSI / EXE',
    // NSIS-установщик как основной файл, MSI — запасной
    file: /-setup\.exe$|\.msi$/i,
    ext: '-setup.exe',
  },
];

/**
 * Достаёт версию из тела релиза. Формат задаёт workflow оболочки: строка `version: X.Y.Z`.
 * Если её нет — пробует имя ассета, затем тег (для старых релизов вида v0.1.0).
 * @param {{ body?: string, assets?: any[], tag_name: string }} release
 * @returns {string|null}
 */
function releaseVersion(release) {
  const fromBody = /^version:\s*v?([0-9]+\.[0-9]+\.[0-9]+[0-9A-Za-z.\-+]*)\s*$/m.exec(release.body || '');
  if (fromBody) return fromBody[1];

  for (const a of release.assets || []) {
    const m = /-(\d+\.\d+\.\d+[0-9A-Za-z.\-+]*)(?:-setup)?\.(?:apk|msi|exe)$/i.exec(a.name || '');
    if (m) return m[1];
  }

  const tag = (release.tag_name || '').replace(/^v/, '');
  return /^\d+\.\d+\.\d+/.test(tag) ? tag : null;
}

mkdirSync('downloads/files', { recursive: true });

/** Удаляем прежние установщики, чтобы не копилась история версий. */
for (const entry of readdirSync('downloads/files')) {
  if (/\.(apk|msi|exe)$/i.test(entry)) rmSync('downloads/files/' + entry);
}

const results = [];

for (const client of CLIENTS) {
  /** @type {any} */
  let release = null;
  try {
    release = await gh('https://api.github.com/repos/' + client.repo + '/releases/tags/latest');
  } catch (err) {
    console.warn(client.name + ': релиз latest недоступен — ' + err.message);
  }

  if (!release) {
    writeFileSync('downloads/' + client.name + '.json', JSON.stringify({
      name: client.name,
      title: client.title,
      platform: client.platform,
      version: null,
      updated: null,
      file: null,
      changelog: [],
      repo: 'https://github.com/' + client.repo,
    }, null, 2) + '\n');
    results.push(client.name + ': пусто');
    continue;
  }

  const version = releaseVersion(release);
  if (!version) {
    console.warn(client.name + ': не удалось определить версию — в теле релиза нет строки version:');
  }

  const asset = pickAsset(release, client.file);
  let filePath = null;
  let size = null;

  if (asset) {
    const fileName = 'MiniAppHub-' + (version || 'unversioned') + '-' + client.name + client.ext;
    const res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'miniapphub-sync' } });
    if (!res.ok) throw new Error('скачивание ' + asset.name + ' → HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync('downloads/files/' + fileName, buf);
    filePath = 'downloads/files/' + fileName;
    size = buf.length;
  }

  const meta = {
    name: client.name,
    title: client.title,
    platform: client.platform,
    version,
    // published_at у плавающего релиза остаётся датой создания, поэтому updated_at
    updated: (release.updated_at || release.published_at || '').slice(0, 10) || null,
    file: filePath,
    size,
    // строка version — служебная, в список изменений не идёт
    changelog: changelog(release.body).filter((line) => !/^version:/i.test(line)),
    repo: 'https://github.com/' + client.repo,
    release: release.html_url,
  };
  writeFileSync('downloads/' + client.name + '.json', JSON.stringify(meta, null, 2) + '\n');
  results.push(client.name + ': v' + meta.version + (filePath ? ' + ' + filePath : ' (без файла)'));
}

console.log('оболочки:\n  ' + results.join('\n  '));
