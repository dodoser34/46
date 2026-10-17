# Бэкенд

Код FastAPI — в `app/`, тесты — в `tests/`, локальная база — в `data/`.

Из этой папки:

```powershell
.\start.cmd
```

API: http://localhost:8000/docs. Зависимости и база создаются автоматически при первом запуске.
Настройки хранятся в `.env` (пример — `.env.example`).
Для установки зависимостей тестирования: `.\setup.cmd`.
Для тестов: `.\.venv\Scripts\python.exe -m pytest -q`.
