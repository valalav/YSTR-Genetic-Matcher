# PostgreSQL YSTR Matcher - Quick Start Guide 🚀

## Что это?

Высокопроизводительная система поиска генетических совпадений Y-DNA с использованием PostgreSQL.

**Преимущества:**
- ⚡ Поиск за 5-22ms (в 1,363 раза быстрее CSV)
- 🗄️ 162,879 профилей, 26,618 гаплогрупп
- 🎯 Фильтрация по гаплогруппам
- 🧬 Подсветка редких маркеров
- 📊 Детальная таблица результатов

---

## Быстрый старт (5 минут)

### 1. Запустить сервисы

```bash
# В папке backend запустить Docker Compose
cd backend
docker-compose up -d

# Проверить статус
docker ps
```

Должны быть запущены:
- `ystr-postgres` (PostgreSQL)
- `ystr-backend` (Backend API)
- `ystr-redis` (Кэш)

### 2. Проверить работу API

```bash
# Health check
curl http://localhost:9004/health

# Список гаплогрупп
curl http://localhost:9004/api/databases/haplogroups?minProfiles=1000

# Тестовый поиск
curl -X POST http://localhost:9004/api/profiles/find-matches \
  -H "Content-Type: application/json" \
  -d '{"markers":{"DYS19":"14","DYS390":"21"},"maxDistance":5}'
```

### 3. Запустить фронтенд

```bash
cd str-matcher
npm run dev
```

Открыть: http://localhost:3000/backend-search

### 4. Применить патч (опционально)

Для включения селектора гаплогрупп см. [docs/BACKEND-SEARCH-PATCH.md](docs/BACKEND-SEARCH-PATCH.md)

---

## Архитектура

```
Frontend (Next.js)      Backend (Express)      Database
http://localhost:3000   http://localhost:9004  PostgreSQL 15
         │                      │                      │
         │   REST API           │                      │
         ├─────────────────────►│   SQL Queries        │
         │                      ├─────────────────────►│
         │                      │                      │
         │                      │   Redis Cache        │
         │                      ├─────────────────────►│
         │                      │                      │
         │◄─────────────────────┤                      │
         │   JSON Results       │◄─────────────────────┤
```

---

## API Endpoints

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/health` | Проверка здоровья сервиса |
| GET | `/api/databases/haplogroups` | Список гаплогрупп |
| GET | `/api/databases/stats` | Общая статистика БД |
| POST | `/api/profiles/find-matches` | Поиск совпадений |
| GET | `/api/profiles/:kitNumber` | Получить профиль по ID |

Полная документация API: [docs/POSTGRES-IMPLEMENTATION-COMPLETE.md](docs/POSTGRES-IMPLEMENTATION-COMPLETE.md)

---

## Структура файлов

```
DNA-utils-universal/
├── backend/
│   ├── routes/
│   │   ├── databases.js         ← API для гаплогрупп (НОВОЕ)
│   │   ├── profiles.js          ← API для профилей
│   │   └── admin.js             ← Админ API
│   ├── services/
│   │   └── matchingService.js   ← Логика поиска
│   └── scripts/
│       └── import-csv-to-postgres.js  ← Импорт CSV
│
├── database/
│   ├── schema.sql               ← Основная схема БД
│   ├── haplogroup-databases-table.sql  ← Таблица метаданных (НОВОЕ)
│   └── fix-function.sql         ← Исправление функций (НОВОЕ)
│
├── str-matcher/src/
│   ├── components/str-matcher/
│   │   ├── BackendSearch.tsx           ← Основной интерфейс
│   │   ├── HaplogroupSelector.tsx      ← Селектор гаплогрупп (НОВОЕ)
│   │   └── AdvancedMatchesTable.tsx    ← Таблица результатов
│   └── hooks/
│       ├── useBackendAPI.ts            ← API хук
│       └── useHaplogroupsList.ts       ← Хук для гаплогрупп (НОВОЕ)
│
└── docs/
    ├── POSTGRES-IMPLEMENTATION-COMPLETE.md  ← Полная документация (НОВОЕ)
    ├── BACKEND-SEARCH-PATCH.md              ← Патч для интеграции (НОВОЕ)
    ├── POSTGRES-TEST-RESULTS.md             ← Результаты тестов (НОВОЕ)
    ├── DATA-IMPORT-GUIDE.md                 ← Руководство импорта (НОВОЕ)
    └── POSTGRES-QUICKSTART.md               ← Быстрый старт (НОВОЕ)
```

---

## Использование

### Поиск по Kit Number

1. Открыть http://localhost:3000/backend-search
2. Выбрать "Search by Kit Number"
3. Ввести номер: `177900`
4. (Опционально) Выбрать гаплогруппу из списка
5. Нажать "Search for Matches"

### Поиск по маркерам

1. Выбрать "Search by Markers"
2. Ввести значения STR маркеров
3. (Опционально) Выбрать гаплогруппу
4. Нажать "Search by Markers"

### Настройки поиска

- **Max Genetic Distance (GD)** - максимальная генетическая дистанция (0-50)
- **Max Results** - максимальное количество результатов (1-1000)
- **Haplogroup Filter** - фильтр по гаплогруппе (опционально)

---

## База данных

### Текущее состояние:

- **Профилей**: 162,879
- **Гаплогрупп**: 26,618
- **Средних маркеров**: 42.3 на профиль
- **Размер БД**: ~500MB

### Топ гаплогрупп:

| Гаплогруппа | Профилей | Средних маркеров |
|-------------|----------|------------------|
| I-M253 | 24,181 | 45.28 |
| E-M35 | 10,873 | 40.58 |
| J-M172 | 10,393 | 39.83 |
| I-M223 | 8,328 | 43.65 |
| R-M198 | 7,894 | 51.03 |

### Импорт дополнительных данных:

```bash
# Импорт CSV файла
cd backend
node scripts/import-csv-to-postgres.js \
  --file=../scripts/downloads/r1a.csv \
  --haplogroup=R1a \
  --batch-size=5000

# Проверка импорта
docker exec ystr-postgres psql -U postgres -d ystr_matcher \
  -c "SELECT COUNT(*) FROM ystr_profiles WHERE haplogroup LIKE 'R-%';"
```

Подробнее: [docs/DATA-IMPORT-GUIDE.md](docs/DATA-IMPORT-GUIDE.md)

---

## Производительность

| Операция | Время | Профилей |
|----------|-------|----------|
| Поиск по всей БД | 22ms | 162,879 |
| Поиск с фильтром I-M253 | 5ms | 24,181 |
| Поиск с фильтром R-M198 | 3ms | 7,894 |
| Health Check | <10ms | - |
| Список гаплогрупп | <15ms | 26,618 |

### Сравнение с CSV:

| Метрика | PostgreSQL | CSV | Улучшение |
|---------|------------|-----|-----------|
| Скорость | 5-22ms | 30s | **1,363x** ⚡ |
| Память | 50MB | 2GB | **40x** 💾 |
| Конкурентность | Высокая | Низкая | ✅ |

---

## Устранение проблем

### Backend не запускается

```bash
# Проверить логи
docker logs ystr-backend --tail 50

# Перезапустить
docker-compose restart backend
```

### PostgreSQL не подключается

```bash
# Проверить статус
docker exec ystr-postgres psql -U postgres -c "SELECT 1;"

# Проверить пароль в backend/.env
cat backend/.env | grep DB_PASSWORD
```

### Фронтенд не загружает гаплогруппы

```bash
# Проверить API
curl http://localhost:9004/api/databases/haplogroups

# Проверить CORS в backend/server.js
# CORS_ORIGIN должен быть http://localhost:3000
```

---

## Документация

📖 **Основная документация:**
- [POSTGRES-IMPLEMENTATION-COMPLETE.md](docs/POSTGRES-IMPLEMENTATION-COMPLETE.md) - Полная документация проекта
- [POSTGRES-TEST-RESULTS.md](docs/POSTGRES-TEST-RESULTS.md) - Результаты тестирования

🔧 **Технические руководства:**
- [DATA-IMPORT-GUIDE.md](docs/DATA-IMPORT-GUIDE.md) - Импорт данных
- [POSTGRES-QUICKSTART.md](docs/POSTGRES-QUICKSTART.md) - Быстрый старт для разработчиков
- [BACKEND-SEARCH-PATCH.md](docs/BACKEND-SEARCH-PATCH.md) - Патч для BackendSearch.tsx

📋 **Планирование:**
- [POSTGRES-INTEGRATION-PLAN.md](docs/POSTGRES-INTEGRATION-PLAN.md) - План интеграции (15 этапов)

---

## Статус проекта

### ✅ Готово (95%):

- [x] PostgreSQL база данных (162,879 профилей)
- [x] Backend API (3 новых endpoint)
- [x] Frontend компоненты (HaplogroupSelector, AdvancedMatchesTable)
- [x] React hooks (useHaplogroupsList)
- [x] Производительность (5-22ms)
- [x] Документация (5 файлов)

### ⏳ Осталось (5%):

- [ ] Применить патч к BackendSearch.tsx (5 минут)

### 🎯 Следующие улучшения:

- [ ] Импорт R1b данных (~50k профилей)
- [ ] Table Partitioning для оптимизации
- [ ] Export to CSV
- [ ] Batch Upload UI

---

## Контакты и поддержка

**Документация**: См. папку `docs/`
**Issues**: Создать issue в репозитории
**Тестирование**: См. [POSTGRES-TEST-RESULTS.md](docs/POSTGRES-TEST-RESULTS.md)

---

**Версия**: 1.0
**Последнее обновление**: 2025-10-05
**Статус**: ✅ Ready for Production (95%)
