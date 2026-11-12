# miniapphub.github.io — портал

Статический портал платформы MiniAppHub на GitHub Pages. Без сборки.

```
index.html        лендинг: что это, как устроено, пример API
catalog.html      каталог мини-приложений из catalog.json
docs.html         документация API и контракта приложений
downloads.html    сборки оболочек Android и Windows
assets/           стили и клиент моста
downloads/        метаданные и установщики (обновляются роботом)
scripts/          синхронизация каталога и скачиваний
sources.json      список мини-приложений-источников
```

## Каталог внутри оболочки
На `catalog.html` подключён `assets/bridge.js`. Если страница открыта из оболочки
(`window.parent !== window`), появляется установка в один клик: страница вызывает
`apps.installApp`, а оболочка разрешает это по совпадению origin с `catalogUrl`.

## Автообновление
- **Релиз мини-приложения** → `repository_dispatch` (`app-release`) → `catalog.json`.
- **Релиз оболочки** → `repository_dispatch` (`shell-release`) → `downloads/*.json` и файл установщика.
- Ежедневные cron-запуски как страховка.

Для кросс-репозиторных событий нужен секрет `PORTAL_TOKEN` в репозиториях оболочек и приложений
(fine-grained PAT с правом Contents: read на портал).
