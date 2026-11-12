// Собирает downloads/<client>.json и downloads/files/ из последних релизов оболочек.
// У каждой оболочки — свой файл и свой установщик; старый файл удаляется.
import { mkdirSync, readdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { gh, changelog, pickAsset } from './lib.mjs';

/** Описание клиентов: репозиторий, заголовок, платформа и какой файл считать установщиком. */
const CLIENTS = [
  {
    repo: 'MiniAppHub/appshell-mobile',
    name: 'appshell-mobile',
    title: 'Android',
    platform: 'Android · APK',
    file: /\.apk$/i,
  },
  {
    repo: 'MiniAppHub/appshell-desktop',
    name: 'appshell-desktop',
    title: 'Windows',
    platform: 'Windows · MSI / EXE',
    file: /\.(msi|exe)$/i,
  },
];

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
    release = await gh('https://api.github.com/repos/' + client.repo + '/releases/latest');
  } catch (err) {
    console.warn(client.name + ': релизов пока нет — ' + err.message);
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

  const asset = pickAsset(release, client.file);
  let filePath = null;
  let size = null;

  if (asset) {
    const fileName = 'MiniAppHub-' + release.tag_name.replace(/^v/, '') + '-' + client.name +
      (asset.name.toLowerCase().endsWith('.apk') ? '.apk' : asset.name.toLowerCase().endsWith('.msi') ? '.msi' : '-setup.exe');
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
    version: release.tag_name.replace(/^v/, ''),
    updated: (release.published_at || '').slice(0, 10),
    file: filePath,
    size,
    changelog: changelog(release.body),
    repo: 'https://github.com/' + client.repo,
    release: release.html_url,
  };
  writeFileSync('downloads/' + client.name + '.json', JSON.stringify(meta, null, 2) + '\n');
  results.push(client.name + ': v' + meta.version + (filePath ? ' + ' + filePath : ' (без файла)'));
}

console.log('оболочки:\n  ' + results.join('\n  '));
