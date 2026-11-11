# MiniAppHub — портал

Публичный каталог мини-приложений экосистемы MiniAppHub.

- `index.html` — страница каталога (статическая, без сборки, Vanilla JS).
- `catalog.json` — реестр приложений. Обновляется автоматически при релизе (см. `template`).
- `versions.json` — актуальные версии клиента `appshell` по каналам (`stable`, `beta`).

## Как попасть в каталог
1. Сделайте fork репозитория [template](https://github.com/MiniAppHub/template) и создайте своё приложение.
2. Откройте Pull Request — GitHub Actions проверит манифест и подготовит релиз.
3. После релиза запись появится в `catalog.json`.

Хостинг: GitHub Pages (ветка `main`, корень).
