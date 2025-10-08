# DNA-utils-universal - Текущее состояние проекта (Октябрь 2025)

## 📋 Оглавление
- [Обзор проекта](#обзор-проекта)
- [История развития](#история-развития)
- [Текущая архитектура](#текущая-архитектура)
- [Критические проблемы](#критические-проблемы)
- [Дорожная карта](#дорожная-карта)

---

## 🎯 Обзор проекта

**DNA-utils-universal** - комплексная система для генетического анализа Y-хромосомы, предоставляющая инструменты для:

1. **Сравнения Y-STR маркеров** - поиск генетических совпадений между ДНК профилями
2. **Анализа гаплогрупп** - исследование филогенетических деревьев Y-хромосомы
3. **Предсказания гаплогрупп (в разработке)** - ML-основанное определение гаплогруппы по маркерам

### Основная задача
Помочь генетическим исследователям и генеалогам находить родственные связи через сравнение коротких тандемных повторов (STR) Y-хромосомы.

---

## 📚 История развития

### Этап 1: Оригинальная версия (до августа 2025)
- **Основа**: STR Matcher с локальной обработкой CSV файлов
- **Архитектура**: Полностью клиентская (браузер)
- **Хранение**: IndexedDB в браузере
- **Проблемы**:
  - Медленная обработка больших файлов (100k+ профилей)
  - Блокировка UI при расчетах
  - Высокое потребление памяти (500MB+)

### Этап 2: Оптимизация (август 2025)
- **Революционные улучшения**:
  - ✅ Потоковая обработка файлов (streaming)
  - ✅ Web Workers для фоновых расчетов
  - ✅ Сокращение памяти на 95% (500MB → <50MB)
  - ✅ Устранение блокировки UI на 100%
  - ✅ Поддержка файлов до 300k+ профилей

**Результат**: Система работает стабильно, оптимизирована, документирована

### Этап 3: Интеграция гаплогрупп (август 2025)
- ✅ Добавлен FTDNA Haplo компонент
- ✅ Интеграция двух филогенетических деревьев (FTDNA + YFull)
- ✅ API `/api/check-subclade` для иерархической фильтрации
- ✅ Batch API для массовой проверки субкладов
- **Проблемы с короткими SNP (Y6, Y4, Y2)** - частично решены через PathBuilder

### Этап 4: PostgreSQL эксперимент (сентябрь 2025) ⚠️
- 🚧 **НОВАЯ АРХИТЕКТУРА** (параллельно с оригинальной):
  - Backend API (Express + PostgreSQL + Redis)
  - Альтернативная страница `/backend-search`
  - Цель: Поддержка 162k+ профилей на сервере
- ⚠️ **СТАТУС**: Не запущена, требует отладки

### Этап 5: CUDA Predictor (заглушка)
- 📝 Только структура кода
- Нет обученных моделей
- Не интегрирован с остальной системой

---

## 🏗️ Текущая архитектура

### Работающая система (Production-ready)

```
┌─────────────────────────────────────────────────────┐
│          STR Matcher (Next.js) - :9002              │
│                                                     │
│  ┌─────────────┐         ┌──────────────────────┐ │
│  │   Page "/"  │         │ Page "/backend-search"│ │
│  │             │         │      (НЕ РАБОТАЕТ)   │ │
│  │  ✅ Работает│         │  ⚠️ PostgreSQL нужен │ │
│  └─────────────┘         └──────────────────────┘ │
│         │                                          │
│         │  ┌─────────────────────────────────┐   │
│         └─►│ IndexedDB (клиент)              │   │
│            │ • Streaming обработка           │   │
│            │ • Web Workers расчеты           │   │
│            │ • <50MB памяти                  │   │
│            └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                         │
                         │ Запросы к API
                         ▼
┌─────────────────────────────────────────────────────┐
│    FTDNA Haplo API (Express) - :9003                │
│                                                     │
│  API Endpoints:                                     │
│  • /api/search/:haplogroup                         │
│  • /api/check-subclade (критичный!)                │
│  • /api/batch-check-subclades                      │
│  • /api/autocomplete                               │
│  • /api/subclades/:haplogroup                      │
│                                                     │
│  Данные:                                           │
│  • data/get.json (FTDNA tree)                      │
│  • data/ytree.json (YFull tree)                    │
└─────────────────────────────────────────────────────┘
```

### Экспериментальная PostgreSQL система (⚠️ НЕ РАБОТАЕТ)

```
┌─────────────────────────────────────────────────────┐
│     Backend v2 (Express) - :9004                    │
│                                                     │
│  ⚠️ КОНФЛИКТ ПОРТОВ с ftdna_haplo!                 │
│                                                     │
│  API Endpoints:                                     │
│  • POST /api/profiles/find-matches                 │
│  • POST /api/profiles/upload                       │
│  • GET  /api/profiles/:kitNumber                   │
│  • GET  /api/profiles/stats/database               │
│                                                     │
│  Зависимости:                                      │
│  • PostgreSQL 15+ (❌ не настроена)                │
│  • Redis (❌ не запущен)                           │
└─────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│          PostgreSQL Database                        │
│                                                     │
│  Схема готова:                                     │
│  • ystr_profiles (JSONB маркеры)                   │
│  • calculate_genetic_distance()                    │
│  • find_matches_batch()                            │
│  • bulk_insert_profiles()                          │
│                                                     │
│  ❌ База не инициализирована                       │
└─────────────────────────────────────────────────────┘
```

### Frontend-v2 (🚧 В разработке)
```
frontend-v2/
├── src/
│   ├── stores/        # Zustand хранилища
│   ├── types/         # TypeScript типы
│   └── components/    # ❌ Пусто
└── package.json       # ❌ Не установлены зависимости
```

---

## 🔥 Критические проблемы

### 1. **Конфликт портов** ⚠️ КРИТИЧНО

```javascript
// ecosystem.config.js
{
  name: "ftdna-haplo-app",
  PORT: 9004  // ← Переопределяет ftdna_haplo на 9004
}

// backend/server.js
const PORT = process.env.PORT || 9004;  // ← Тоже 9004!

// ftdna_haplo/server/server.js
const PORT = process.env.PORT || 9003;  // ← Дефолт 9003, но PM2 ставит 9004
```

**Результат**: Оба сервиса пытаются занять один порт!

**Решение**:
1. ftdna_haplo → порт 9003 (по умолчанию)
2. backend v2 → порт 9004 (PostgreSQL версия)
3. Обновить `ecosystem.config.js`

### 2. **PostgreSQL не инициализирована** ⚠️

**Текущая ситуация**:
- ✅ Схема готова: `database/schema.sql`
- ✅ Оптимизации готовы: `database/optimizations.sql`
- ❌ База не создана
- ❌ Данные не загружены

**Что нужно**:
```bash
# Установить PostgreSQL
sudo apt install postgresql-15

# Создать базу
sudo -u postgres createdb ystr_matcher

# Инициализировать схему
sudo -u postgres psql -d ystr_matcher -f database/schema.sql
sudo -u postgres psql -d ystr_matcher -f database/optimizations.sql

# Настроить .env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ystr_matcher
DB_USER=postgres
DB_PASSWORD=your_secure_password
```

### 3. **Две параллельные архитектуры**

**Проблема**: Система раздвоена

| Компонент | Оригинальная версия | PostgreSQL версия |
|-----------|--------------------|--------------------|
| **Frontend** | STR Matcher `/` | `/backend-search` |
| **Хранение** | IndexedDB (клиент) | PostgreSQL (сервер) |
| **Расчеты** | Web Workers | SQL функции |
| **Статус** | ✅ Работает | ❌ Не работает |

**Стратегия**:
1. ✅ Оставить оригинальную версию как fallback
2. 🔧 Довести PostgreSQL версию до рабочего состояния
3. 🎯 Дать пользователю выбор: клиент vs сервер

### 4. **Docker Compose не запущен**

```yaml
# docker-compose.yml готов для:
- postgres:15-alpine
- redis:7-alpine
- backend (Express)
- cuda-predictor (FastAPI)
- frontend (Next.js)
- nginx (reverse proxy)
- prometheus + grafana (мониторинг)
```

**Проблема**: Никогда не тестировался!

### 5. **CUDA Predictor - заглушка**

```python
# cuda-predictor/main.py
# ✅ Код структуры есть
# ✅ Pydantic модели готовы
# ❌ Нет обученных моделей в models/
# ❌ Не интегрирован с backend
```

---

## 📊 Компоненты по статусу

### ✅ Production Ready
1. **STR Matcher (оригинальный)**
   - Страница `/`
   - IndexedDB + Web Workers
   - Поддержка до 300k профилей
   - Streaming обработка
   - Оптимизирован, протестирован

2. **FTDNA Haplo API**
   - Порт 9003 (дефолт)
   - Работа с филогенетическими деревьями
   - `/api/check-subclade` для фильтрации
   - Batch API для массовых проверок

### 🚧 В разработке
3. **Backend v2 (PostgreSQL)**
   - Код готов
   - Схема БД готова
   - Не запущен (нужна настройка)

4. **Backend Search UI**
   - Компоненты готовы
   - useBackendAPI хук готов
   - Зависит от Backend v2

### 📝 Заглушки
5. **CUDA Predictor**
   - Только структура кода

6. **Frontend-v2**
   - Только Zustand stores

---

## 🛠️ Дорожная карта

### Фаза 1: Исправление критических проблем (Неделя 1)

#### 1.1 Разрешить конфликт портов
```javascript
// ecosystem.config.js - ИСПРАВИТЬ
{
  name: "ftdna-haplo-app",
  script: "./ftdna_haplo/server/server.js",
  env_production: {
    PORT: 9003  // ← Было 9004, ставим 9003
  }
}
```

#### 1.2 Настроить PostgreSQL
- [ ] Установить PostgreSQL 15
- [ ] Создать базу `ystr_matcher`
- [ ] Выполнить `schema.sql` + `optimizations.sql`
- [ ] Настроить `.env` в `backend/`
- [ ] Протестировать подключение

#### 1.3 Запустить Backend v2
```bash
cd backend
npm install
npm start  # Порт 9004
```

#### 1.4 Протестировать `/backend-search`
- [ ] Загрузить тестовые данные в PostgreSQL
- [ ] Открыть http://localhost:9002/backend-search
- [ ] Проверить поиск по Kit Number
- [ ] Проверить поиск по маркерам

### Фаза 2: Интеграция и тестирование (Неделя 2)

#### 2.1 Миграция данных
```bash
# Скрипт для загрузки существующих CSV в PostgreSQL
node scripts/migrate-csv-to-postgres.js
```

#### 2.2 Сравнительное тестирование
- [ ] Одинаковые результаты: IndexedDB vs PostgreSQL
- [ ] Производительность: клиент vs сервер
- [ ] Нагрузочное тестирование

#### 2.3 Docker Compose
```bash
# Первый запуск Docker окружения
docker-compose up -d

# Проверка всех сервисов
docker-compose ps
```

### Фаза 3: Production готовность (Неделя 3-4)

#### 3.1 Улучшения Backend v2
- [ ] Настроить Redis кэширование
- [ ] Добавить rate limiting
- [ ] Логирование и мониторинг
- [ ] Оптимизация SQL запросов

#### 3.2 UI/UX улучшения
- [ ] Индикатор выбора: клиент vs сервер
- [ ] Статистика производительности
- [ ] Автосохранение настроек

#### 3.3 Документация
- [ ] API документация (Swagger/OpenAPI)
- [ ] Руководство развертывания
- [ ] Troubleshooting guide

### Фаза 4: ML Predictor (Будущее)

#### 4.1 Обучение моделей
- [ ] Подготовка обучающего датасета
- [ ] Обучение CNN модели
- [ ] Обучение XGBoost модели
- [ ] Ансамбль моделей

#### 4.2 Интеграция
- [ ] CUDA service → Backend API
- [ ] UI для предсказаний
- [ ] Confidence scoring

---

## 📁 Структура проекта (финальная)

```
DNA-utils-universal/
├── str-matcher/              # ✅ Next.js Frontend (9002)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                    # ✅ Оригинальная версия
│   │   │   └── backend-search/page.tsx     # 🚧 PostgreSQL версия
│   │   ├── components/str-matcher/
│   │   ├── workers/                         # ✅ Web Workers
│   │   └── utils/storage/                   # ✅ IndexedDB
│   └── next.config.js
│
├── ftdna_haplo/              # ✅ Haplogroup API (9003)
│   ├── server/
│   │   ├── server.js                        # ✅ Express API
│   │   └── services/haplogroup-service.js   # ✅ Бизнес-логика
│   ├── data/
│   │   ├── get.json                         # ✅ FTDNA tree
│   │   └── ytree.json                       # ✅ YFull tree
│   └── client/                              # React viewer
│
├── backend/                  # 🚧 PostgreSQL Backend (9004)
│   ├── server.js                            # ✅ Express API
│   ├── routes/
│   │   ├── profiles.js                      # ✅ STR endpoints
│   │   ├── haplogroups.js                   # ✅ Haplogroup endpoints
│   │   └── admin.js                         # ✅ Admin endpoints
│   ├── services/
│   │   └── matchingService.js               # ✅ Бизнес-логика
│   └── config/database.js                   # ✅ PostgreSQL pool
│
├── database/                 # ✅ PostgreSQL схема
│   ├── schema.sql                           # ✅ Таблицы и функции
│   └── optimizations.sql                    # ✅ Индексы
│
├── cuda-predictor/           # 📝 ML Service (8080)
│   ├── main.py                              # 📝 FastAPI структура
│   ├── models/                              # ❌ Нет моделей
│   └── requirements.txt
│
├── frontend-v2/              # 📝 Новый frontend
│   └── src/stores/                          # 📝 Zustand
│
├── docker-compose.yml        # ✅ Готов (не тестировался)
├── ecosystem.config.js       # ⚠️ Конфликт портов
└── docs/                     # ✅ Документация
```

---

## 🎯 Текущие приоритеты

### Срочно (эта неделя)
1. ✅ **Создать этот документ** - понять текущую ситуацию
2. 🔧 **Исправить конфликт портов** - ftdna_haplo:9003, backend:9004
3. 🔧 **Настроить PostgreSQL** - создать базу, выполнить схему
4. 🔧 **Запустить Backend v2** - протестировать `/backend-search`

### Важно (следующие 2 недели)
5. 📊 **Загрузить данные в PostgreSQL** - миграция из CSV
6. 🧪 **Сравнительное тестирование** - IndexedDB vs PostgreSQL
7. 🐳 **Запустить Docker Compose** - полное окружение
8. 📈 **Мониторинг и логирование** - Prometheus + Grafana

### Можно отложить
9. 🤖 **CUDA Predictor** - обучение моделей
10. 🎨 **Frontend-v2** - новый UI

---

## 💡 Ключевые выводы

### Что работает ✅
1. **STR Matcher (оригинальный)** - полностью функционален
   - Оптимизирован для 300k+ профилей
   - Streaming архитектура
   - 95% экономии памяти

2. **FTDNA Haplo API** - стабильная интеграция
   - Работа с двумя филогенетическими деревьями
   - Иерархическая фильтрация гаплогрупп
   - Batch API для производительности

### Что не работает ❌
1. **PostgreSQL Backend** - код готов, но не запущен
   - Конфликт портов
   - База не инициализирована
   - Нет тестовых данных

2. **Backend Search UI** - зависит от Backend v2
   - Компоненты готовы
   - Не может подключиться к API

3. **Docker Compose** - никогда не запускался

4. **CUDA Predictor** - только заглушка

### Стратегия ⭐
1. **Краткосрочно**: Исправить Backend v2, запустить PostgreSQL версию
2. **Среднесрочно**: Дать выбор пользователю (клиент/сервер)
3. **Долгосрочно**: ML предсказания гаплогрупп

---

## 📞 Следующие шаги

### Для разработчика:
1. Прочитать этот документ полностью
2. Исправить конфликт портов в `ecosystem.config.js`
3. Установить PostgreSQL и выполнить `database/schema.sql`
4. Настроить `backend/.env`
5. Запустить `cd backend && npm start`
6. Открыть http://localhost:9002/backend-search
7. Протестировать поиск

### Для тестирования:
```bash
# 1. Оригинальная версия (работает)
npm run dev
# Открыть: http://localhost:9002

# 2. PostgreSQL версия (после настройки)
cd backend && npm start  # Терминал 1
npm run dev              # Терминал 2
# Открыть: http://localhost:9002/backend-search
```

---

**Документ актуален на**: Октябрь 2025
**Автор**: Анализ проекта DNA-utils-universal
**Статус**: Требует исправления Backend v2 и PostgreSQL настройки
