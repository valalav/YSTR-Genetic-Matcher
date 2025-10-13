# PostgreSQL Integration Plan
## Интеграция быстрого поиска через PostgreSQL с предзагруженными базами

---

## 🎯 Цель проекта

Создать высокопроизводительную систему поиска генетических совпадений через PostgreSQL, где:
- **Базы профилей предзагружены** в БД (162,000+ профилей)
- **Пользователь выбирает** нужные гаплогруппы из списка
- **Поиск работает мгновенно** благодаря индексам PostgreSQL
- **Интерфейс аналогичен** текущей таблице матчей (CSV-based)
- **Фильтрация и сортировка** работают быстрее чем в CSV версии
- **НЕ ломается** существующий функционал (CSV matcher)

---

## 📊 Текущее состояние проекта

### ✅ Уже реализовано:

1. **PostgreSQL Backend** (`/backend/`)
   - Express сервер на порту 9004
   - PostgreSQL connection pool
   - Routes: `/api/profiles/find-matches`, `/api/profiles/upload`
   - Redis кеширование результатов
   - Rate limiting и security middleware

2. **Database Schema** (`/database/schema.sql`)
   - Таблица `ystr_profiles` с JSONB markers
   - Функция `calculate_genetic_distance()` для подсчёта дистанции
   - Функция `find_matches_batch()` для быстрого поиска
   - GIN индексы на JSONB markers
   - Materialized view для статистики маркеров

3. **Frontend Component** (`/str-matcher/src/components/str-matcher/BackendSearch.tsx`)
   - UI для поиска по kit number
   - UI для поиска по custom markers
   - Отображение результатов в `AdvancedMatchesTable`
   - Статистика БД (total profiles, haplogroups, etc.)

4. **API Hooks** (`/str-matcher/src/hooks/useBackendAPI.ts`)
   - `findMatches()` - поиск матчей
   - `getProfile()` - получение профиля по kit number
   - `getDatabaseStats()` - статистика БД

### ❌ Что НЕ работает / Чего не хватает:

1. **Нет интерфейса выбора баз гаплогрупп**
   - Нельзя выбрать "загрузить R1b базу"
   - Нельзя выбрать "добавить E1b базу к существующим"
   - Нет списка доступных баз для загрузки

2. **Нет предзагруженных профилей**
   - База пустая (есть только 5 тестовых записей)
   - Нужно импортировать 162,000+ профилей из существующих CSV

3. **Медленная фильтрация больших гаплогрупп**
   - R1b содержит 50,000+ профилей
   - Поиск без оптимизации будет медленным
   - Нет партиционирования таблицы по гаплогруппам

4. **Нет управления базами**
   - Нет UI для просмотра загруженных баз
   - Нет статистики по каждой гаплогруппе
   - Нет возможности удалить/обновить базу

5. **Таблица матчей не оптимизирована**
   - `AdvancedMatchesTable` работает, но не протестирована на 10,000+ результатах
   - Нет виртуализации для больших списков
   - Нет пагинации на backend уровне

---

## 🏗️ Архитектура решения

### Компоненты системы:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  ┌──────────────────────┐     ┌─────────────────────────┐  │
│  │   DatabaseManager    │     │   BackendSearchPage     │  │
│  │  (выбор гаплогрупп)  │────>│  (поиск матчей)         │  │
│  └──────────────────────┘     └─────────────────────────┘  │
│            │                              │                  │
│            │ useBackendAPI                │                  │
│            v                              v                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          API Route (/api/backend/...)                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP (port 9004)
┌─────────────────────────v───────────────────────────────────┐
│                Backend (Express.js)                          │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │ POST /find   │  │ GET /databases│  │ POST /load-base │  │
│  │   -matches   │  │               │  │                 │  │
│  └──────────────┘  └───────────────┘  └─────────────────┘  │
│         │                  │                    │            │
│         v                  v                    v            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         matchingService + databaseService            │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          v                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Redis Cache (1 hour TTL)                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬────────────────────────────────────┘
                          │
┌─────────────────────────v────────────────────────────────────┐
│                   PostgreSQL Database                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ystr_profiles (partitioned by haplogroup)            │  │
│  │  - R1b partition (50,000 profiles)                     │  │
│  │  - R1a partition (30,000 profiles)                     │  │
│  │  - E1b partition (20,000 profiles)                     │  │
│  │  - ... other partitions                                │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  haplogroup_databases                                  │  │
│  │  (метаданные: размер, дата загрузки, статус)          │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Indexes: GIN on markers, B-tree on haplogroup        │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## 📝 Детальный план реализации

### **ЭТАП 1: Подготовка базы данных**

#### 1.1. Создать метаданные для баз гаплогрупп
**Файл:** `database/haplogroup-databases-table.sql`

**Задача:**
- Создать таблицу `haplogroup_databases` для хранения метаданных
- Поля: id, haplogroup, total_profiles, loaded_at, status, source_file, avg_markers

**SQL:**
```sql
CREATE TABLE haplogroup_databases (
    id SERIAL PRIMARY KEY,
    haplogroup VARCHAR(50) NOT NULL UNIQUE,
    total_profiles INTEGER DEFAULT 0,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active', -- active, loading, error
    source_file VARCHAR(255),
    avg_markers DECIMAL(5,2),
    description TEXT
);

CREATE INDEX idx_haplogroup_databases_status ON haplogroup_databases(status);
```

#### 1.2. Добавить партиционирование таблицы ystr_profiles
**Файл:** `database/partitioning.sql`

**Задача:**
- Создать партиции для больших гаплогрупп (R1b, R1a, E1b, J, G, I, N, Q)
- Оптимизировать поиск внутри партиций

**SQL:**
```sql
-- Партиционирование по хешу haplogroup
ALTER TABLE ystr_profiles RENAME TO ystr_profiles_old;

CREATE TABLE ystr_profiles (
    LIKE ystr_profiles_old INCLUDING ALL
) PARTITION BY HASH (haplogroup);

-- Создать 16 партиций для равномерного распределения
CREATE TABLE ystr_profiles_p0 PARTITION OF ystr_profiles
    FOR VALUES WITH (MODULUS 16, REMAINDER 0);
-- ... repeat for p1 through p15

-- Перенести данные из старой таблицы
INSERT INTO ystr_profiles SELECT * FROM ystr_profiles_old;
DROP TABLE ystr_profiles_old;
```

#### 1.3. Оптимизировать функцию find_matches_batch
**Файл:** `database/optimized-find-matches.sql`

**Задача:**
- Добавить поддержку множественных гаплогрупп (`haplogroupFilters: string[]`)
- Добавить пагинацию (offset, limit)
- Улучшить производительность для больших результатов

---

### **ЭТАП 2: Backend API для управления базами**

#### 2.1. Создать DatabaseService
**Файл:** `backend/services/databaseService.js`

**Методы:**
- `listAvailableDatabases()` - список доступных CSV баз в `/data/haplogroups/`
- `getLoadedDatabases()` - список загруженных баз из `haplogroup_databases`
- `loadDatabase(haplogroup, csvFilePath)` - импорт CSV в PostgreSQL
- `deleteDatabase(haplogroup)` - удаление профилей гаплогруппы
- `getDatabaseStats(haplogroup)` - статистика по гаплогруппе

**Пример:**
```javascript
class DatabaseService {
  async listAvailableDatabases() {
    // Сканировать /data/haplogroups/ для CSV файлов
    // Вернуть [{haplogroup: 'R1b', filename: 'R1b.csv', size: '50MB'}, ...]
  }

  async loadDatabase(haplogroup, csvFilePath, options = {}) {
    // 1. Установить status = 'loading' в haplogroup_databases
    // 2. Прочитать CSV с помощью Papa Parse
    // 3. Использовать bulk_insert_profiles() для вставки
    // 4. Обновить статистику (total_profiles, avg_markers)
    // 5. Установить status = 'active'
  }
}
```

#### 2.2. Создать routes для управления базами
**Файл:** `backend/routes/databases.js`

**Endpoints:**
- `GET /api/databases/available` - список доступных CSV баз
- `GET /api/databases/loaded` - список загруженных баз
- `POST /api/databases/load` - загрузить базу из CSV
- `DELETE /api/databases/:haplogroup` - удалить базу
- `GET /api/databases/:haplogroup/stats` - статистика по базе

#### 2.3. Обновить matchingService для фильтрации по множественным гаплогруппам
**Файл:** `backend/services/matchingService.js`

**Изменения:**
- Поддержка `haplogroupFilters: string[]` вместо `haplogroupFilter: string`
- Использовать `IN (...)` вместо `LIKE`
- Оптимизация для больших фильтров

---

### **ЭТАП 3: Frontend компоненты**

#### 3.1. Создать DatabaseManager компонент
**Файл:** `str-matcher/src/components/str-matcher/DatabaseManager.tsx`

**Функционал:**
- Список доступных баз (из CSV)
- Список загруженных баз (из PostgreSQL)
- Кнопка "Load Database" для каждой доступной базы
- Прогресс-бар загрузки
- Статистика: profiles, avg markers, loaded date
- Кнопка "Delete" для каждой загруженной базы

**UI:**
```tsx
<div>
  <h2>Available Databases (CSV)</h2>
  <table>
    <tr>
      <td>R1b</td>
      <td>50,234 profiles</td>
      <td>R1b.csv (45MB)</td>
      <td><button>Load to PostgreSQL</button></td>
    </tr>
  </table>

  <h2>Loaded Databases (PostgreSQL)</h2>
  <table>
    <tr>
      <td>R1a</td>
      <td>32,156 profiles</td>
      <td>Loaded: 2025-10-01</td>
      <td><button>Delete</button></td>
    </tr>
  </table>
</div>
```

#### 3.2. Добавить фильтр гаплогрупп в BackendSearch
**Файл:** `str-matcher/src/components/str-matcher/BackendSearch.tsx`

**Изменения:**
- Dropdown "Select Haplogroups" с мультивыбором
- Чекбоксы для загруженных гаплогрупп
- Передавать `haplogroupFilters: ['R1b', 'R1a']` в API

#### 3.3. Оптимизировать AdvancedMatchesTable
**Файл:** `str-matcher/src/components/str-matcher/AdvancedMatchesTable.tsx`

**Изменения:**
- Добавить react-window для виртуализации (10,000+ строк)
- Добавить серверную пагинацию (offset/limit)
- Ленивая загрузка: "Load More" кнопка

---

### **ЭТАП 4: Импорт данных**

#### 4.1. Подготовить CSV базы гаплогрупп
**Директория:** `/data/haplogroups/`

**Задача:**
- Разделить существующие CSV на файлы по гаплогруппам
- Файлы: `R1b.csv`, `R1a.csv`, `E1b.csv`, и т.д.

**Скрипт:**
```bash
node scripts/split-csv-by-haplogroup.js
```

#### 4.2. Создать CLI для массовой загрузки
**Файл:** `backend/scripts/load-all-databases.js`

**Использование:**
```bash
node backend/scripts/load-all-databases.js --dir ./data/haplogroups
```

**Функционал:**
- Сканирует директорию
- Загружает каждый CSV через API
- Показывает прогресс-бар

---

### **ЭТАП 5: Тестирование и оптимизация**

#### 5.1. Нагрузочное тестирование
- Протестировать поиск с 162,000 профилями
- Замерить время отклика для разных гаплогрупп
- Цель: < 500ms для поиска в R1b (50k profiles)

#### 5.2. Оптимизация SQL
- Анализ slow queries через `pg_stat_statements`
- Настройка work_mem, shared_buffers
- Создание дополнительных индексов

#### 5.3. UI/UX тестирование
- Проверить отображение 10,000+ результатов
- Убедиться что виртуализация работает плавно
- Проверить что фильтрация не блокирует UI

---

## 🎯 Критерии успеха

### Производительность:
- ✅ Поиск в R1b (50k profiles) < 500ms
- ✅ Поиск в R1a (30k profiles) < 300ms
- ✅ Загрузка базы (50k profiles) < 2 минуты
- ✅ Отображение 10,000 результатов без лагов

### Функциональность:
- ✅ Можно выбрать несколько гаплогрупп для поиска
- ✅ Результаты фильтруются и сортируются как в CSV версии
- ✅ Haplogroup tree работает (ссылка на FTDNA/YFull)
- ✅ CSV matcher продолжает работать (не сломан)

### Удобство:
- ✅ UI для управления базами (load/delete)
- ✅ Статистика по каждой базе
- ✅ Прогресс-бар при загрузке
- ✅ Понятные сообщения об ошибках

---

## 📊 Приоритизация задач

### **HIGH Priority** (критично для MVP):
1. ЭТАП 1.2 - Партиционирование (производительность R1b)
2. ЭТАП 2.1 - DatabaseService (импорт данных)
3. ЭТАП 2.2 - Database routes (API для управления)
4. ЭТАП 3.1 - DatabaseManager UI (выбор баз)
5. ЭТАП 4.1 - Подготовка CSV

### **MEDIUM Priority** (важно, но не блокирует):
6. ЭТАП 1.3 - Оптимизация find_matches_batch
7. ЭТАП 3.2 - Мультивыбор гаплогрупп
8. ЭТАП 3.3 - Виртуализация таблицы
9. ЭТАП 4.2 - CLI для массовой загрузки

### **LOW Priority** (опционально):
10. ЭТАП 1.1 - Метаданные баз (можно сделать позже)
11. ЭТАП 5.1 - Нагрузочное тестирование
12. ЭТАП 5.2 - SQL оптимизация (делать по результатам тестов)

---

## 🚀 План выполнения (пошаговый)

### Неделя 1: Backend + Database
1. Day 1: Партиционирование ystr_profiles
2. Day 2: DatabaseService (load, delete, stats)
3. Day 3: Database routes API
4. Day 4: Тестирование импорта на малых данных
5. Day 5: Оптимизация find_matches_batch

### Неделя 2: Frontend + Data Import
6. Day 6: DatabaseManager компонент
7. Day 7: Интеграция с Backend API
8. Day 8: Подготовка CSV баз
9. Day 9: Массовая загрузка данных
10. Day 10: Тестирование и баг-фиксы

### Неделя 3: Optimization + Polish
11. Day 11: Виртуализация AdvancedMatchesTable
12. Day 12: Мультивыбор гаплогрупп
13. Day 13: Нагрузочное тестирование
14. Day 14: Финальная оптимизация
15. Day 15: Документация и деплой

---

## 🔧 Технические детали

### PostgreSQL Partitioning Strategy:
```sql
-- HASH partitioning для равномерного распределения
PARTITION BY HASH (haplogroup)
-- 16 партиций обеспечат баланс между:
-- - Скоростью поиска (меньше данных на партицию)
-- - Управляемостью (не слишком много партиций)
```

### Redis Caching Strategy:
```javascript
// Cache key structure:
`match:${hashMarkers(markers)}:d${maxDistance}:h${haplogroup}`

// TTL: 1 hour (3600 seconds)
// Invalidation: при загрузке/удалении баз
```

### CSV Import Optimization:
```javascript
// Batch size: 5000 profiles per transaction
// Parallel processing: 4 workers
// Estimated speed: 500 profiles/second
// Total time for 162k: ~5 minutes
```

---

## ⚠️ Риски и митигация

### Риск 1: Медленный поиск в больших гаплогруппах
**Митигация:**
- Партиционирование таблицы
- GIN индексы на JSONB
- Redis кеширование
- Ограничение maxResults

### Риск 2: Долгая загрузка CSV
**Митигация:**
- Background jobs с прогресс-баром
- Batch inserts (5000 per transaction)
- Параллельная обработка

### Риск 3: Сломается существующий CSV matcher
**Митигация:**
- Создать отдельный роут `/backend-search`
- Не трогать существующий код STRMatcher
- Тестировать оба варианта параллельно

### Риск 4: Переполнение памяти при больших результатах
**Митигация:**
- Серверная пагинация (limit/offset)
- Виртуализация на frontend (react-window)
- Ограничение maxResults = 10,000

---

## 📚 Справочная информация

### Похожие проекты:
- FTDNA Big Y Block Tree (партиционирование по SNP)
- YFull YTree (иерархическая фильтрация)
- GEDmatch (batch genetic matching)

### Полезные ссылки:
- PostgreSQL Partitioning: https://www.postgresql.org/docs/current/ddl-partitioning.html
- GIN Indexes: https://www.postgresql.org/docs/current/gin.html
- React Window: https://github.com/bvaughn/react-window

---

## ✅ Checklist перед началом

- [ ] Убедиться что PostgreSQL запущен (порт 5432)
- [ ] Убедиться что Redis запущен (порт 6379)
- [ ] Убедиться что backend запущен (порт 9004)
- [ ] Создать backup текущей БД
- [ ] Подготовить тестовые CSV файлы
- [ ] Проверить что CSV matcher работает (не ломать!)
- [ ] Создать ветку `feature/postgres-integration`

---

**Дата создания:** 2025-10-04
**Автор:** Claude Code
**Версия:** 1.0
