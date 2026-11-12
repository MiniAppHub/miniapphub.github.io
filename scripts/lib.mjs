// Общие помощники для скриптов синхронизации портала.
const TOKEN = process.env.GITHUB_TOKEN || '';

export const H = {
  'User-Agent': 'miniapphub-sync',
  Accept: 'application/vnd.github+json',
  ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}),
};

/**
 * @param {string} url
 * @returns {Promise<any>}
 */
export async function gh(url) {
  const res = await fetch(url, { headers: H });
  if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
  return res.json();
}

/**
 * Разбивает тело релиза GitHub на список строк для каталога.
 * @param {string} body
 * @returns {string[]}
 */
export function changelog(body) {
  if (!body) return [];
  return body.split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('**Full Changelog'))
    .slice(0, 8);
}

/**
 * Ищет в релизе файл по шаблону имени.
 * @param {any} release
 * @param {RegExp} re
 * @returns {any|null}
 */
export function pickAsset(release, re) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  return assets.find((a) => re.test(a.name)) || null;
}
