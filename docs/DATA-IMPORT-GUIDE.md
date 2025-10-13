# Data Import Guide
## Руководство по импорту CSV данных в PostgreSQL

---

## 📊 Доступные источники данных

### CSV Files (в `scripts/downloads/`)

| Файл | Размер | Гаплогруппа | Примерное кол-во профилей |
|------|--------|-------------|---------------------------|
| `I.csv` | 16 MB | I | ~40,000 |
| `r1a.csv` | 6.9 MB | R1a | ~18,000 |
| `E.csv` | 5.9 MB | E | ~15,000 |
| `Others.csv` | 5.5 MB | Others | ~14,000 |
| `J2.csv` | 5.0 MB | J2 | ~13,000 |
| `J1.csv` | 4.8 MB | J1 | ~12,000 |
| `G.csv` | 3.2 MB | G | ~8,000 |
| `aadna.csv` | 0 KB | AADNA | 0 (пустой) |
| `Genopoisk.csv` | 16 KB | Mixed | ~40 |
| **ИТОГО** | **~47 MB** | **Mixed** | **~120,000** |

### Google Sheets Sources

Все CSV можно обновить через API (определены в `str-matcher/src/config/repositories.config.ts`):

- **AADNA.ru**: https://docs.google.com/spreadsheets/.../output=csv
- **R1a**: https://docs.google.com/spreadsheets/.../output=csv
- **E, G, I, J1, J2, Others**: аналогично

### R1b Database (Chunked JSON)

R1b - самая большая база (~50,000+ профилей), хранится в chunked JSON формате:
- `/public/chunk_0.json` through `/public/chunk_15.json`
- 16 чанков
- Требует специальной обработки

---

## 🏗️ Стратегия импорта

### Этап 1: Подготовка БД

```sql
-- 1. Создать таблицу метаданных
CREATE TABLE haplogroup_databases (
    id SERIAL PRIMARY KEY,
    haplogroup VARCHAR(50) NOT NULL UNIQUE,
    total_profiles INTEGER DEFAULT 0,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    source_file VARCHAR(255),
    avg_markers DECIMAL(5,2),
    file_size_mb DECIMAL(10,2),
    description TEXT
);
```

### Этап 2: Импорт маленьких баз (для тестирования)

Начнём с самых маленьких баз для отладки процесса:

1. **Genopoisk.csv** (16 KB, ~40 профилей)
2. **G.csv** (3.2 MB, ~8,000 профилей)
3. **J1.csv** (4.8 MB, ~12,000 профилей)

**Скрипт импорта:**
```javascript
// backend/scripts/import-csv-to-postgres.js
const fs = require('fs');
const Papa = require('papaparse');
const { pool } = require('../config/database');

async function importCSV(filePath, haplogroup) {
  console.log(`Importing ${filePath}...`);

  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const parseResult = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true
  });

  // Transform to profile objects
  const profiles = parseResult.data.map(row => ({
    kitNumber: row.kitNumber || row.kit_number || row.KitNumber,
    name: row.name || row.Name || '',
    country: row.country || row.Country || '',
    haplogroup: row.haplogroup || row.Haplogroup || haplogroup,
    markers: extractMarkers(row)
  })).filter(p => p.kitNumber && Object.keys(p.markers).length > 0);

  console.log(`Found ${profiles.length} valid profiles`);

  // Bulk insert in batches of 5000
  const batchSize = 5000;
  let inserted = 0;

  for (let i = 0; i < profiles.length; i += batchSize) {
    const batch = profiles.slice(i, i + batchSize);
    const result = await pool.query(
      'SELECT bulk_insert_profiles($1)',
      [JSON.stringify(batch)]
    );
    inserted += result.rows[0].bulk_insert_profiles;
    console.log(`Progress: ${inserted}/${profiles.length}`);
  }

  console.log(`✅ Imported ${inserted} profiles`);
  return inserted;
}

function extractMarkers(row) {
  const markers = {};
  const excludeKeys = ['kitnumber', 'kit_number', 'name', 'country', 'haplogroup'];

  Object.keys(row).forEach(key => {
    if (!excludeKeys.includes(key.toLowerCase()) && row[key] && row[key] !== '') {
      markers[key] = row[key];
    }
  });

  return markers;
}

// Usage
importCSV('./scripts/downloads/Genopoisk.csv', 'Mixed').then(() => process.exit(0));
```

### Этап 3: Импорт средних баз

После успешного тестирования на малых данных:

4. **J2.csv** (5.0 MB, ~13,000 профилей)
5. **Others.csv** (5.5 MB, ~14,000 профилей)
6. **E.csv** (5.9 MB, ~15,000 профилей)

### Этап 4: Импорт больших баз

Самые большие базы требуют оптимизации:

7. **r1a.csv** (6.9 MB, ~18,000 профилей)
8. **I.csv** (16 MB, ~40,000 профилей)

**Оптимизации для больших импортов:**
- Отключить триггеры (`ALTER TABLE ystr_profiles DISABLE TRIGGER ALL`)
- Увеличить `work_mem` и `maintenance_work_mem`
- Использовать `COPY` вместо `INSERT` (быстрее в 10 раз)
- Создать индексы ПОСЛЕ импорта

### Этап 5: R1b Chunked JSON

R1b требует специального обработчика:

```javascript
// backend/scripts/import-r1b-chunks.js
async function importR1bChunks() {
  const totalChunks = 16;
  let totalProfiles = 0;

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = `./public/chunk_${i}.json`;
    const chunkData = JSON.parse(fs.readFileSync(chunkPath, 'utf-8'));

    // Convert JSON to profile format
    const profiles = chunkData.map(item => ({
      kitNumber: item.id || item.kitNumber,
      name: item.name || '',
      country: item.country || '',
      haplogroup: item.haplogroup || 'R1b',
      markers: item.markers || {}
    }));

    const inserted = await bulkInsert(profiles);
    totalProfiles += inserted;
    console.log(`Chunk ${i + 1}/${totalChunks}: ${inserted} profiles (total: ${totalProfiles})`);
  }

  return totalProfiles;
}
```

---

## 📋 Пошаговый план импорта

### День 1: Настройка и тестирование

```bash
# 1. Убедиться что PostgreSQL запущен
psql -U postgres -c "SELECT version();"

# 2. Создать базу данных (если не существует)
psql -U postgres -c "CREATE DATABASE ystr_matcher;"

# 3. Применить схему
psql -U postgres -d ystr_matcher -f database/schema.sql

# 4. Создать таблицу метаданных
psql -U postgres -d ystr_matcher -f database/haplogroup-databases-table.sql

# 5. Тестовый импорт (Genopoisk - 40 профилей)
node backend/scripts/import-csv-to-postgres.js --file=scripts/downloads/Genopoisk.csv --haplogroup=Mixed

# 6. Проверить результат
psql -U postgres -d ystr_matcher -c "SELECT COUNT(*) FROM ystr_profiles;"
```

### День 2: Импорт малых и средних баз

```bash
# Импорт G (8k profiles)
node backend/scripts/import-csv-to-postgres.js --file=scripts/downloads/G.csv --haplogroup=G

# Импорт J1 (12k profiles)
node backend/scripts/import-csv-to-postgres.js --file=scripts/downloads/J1.csv --haplogroup=J1

# Импорт J2 (13k profiles)
node backend/scripts/import-csv-to-postgres.js --file=scripts/downloads/J2.csv --haplogroup=J2

# Импорт E (15k profiles)
node backend/scripts/import-csv-to-postgres.js --file=scripts/downloads/E.csv --haplogroup=E

# Импорт Others (14k profiles)
node backend/scripts/import-csv-to-postgres.js --file=scripts/downloads/Others.csv --haplogroup=Others

# Проверить общий прогресс
psql -U postgres -d ystr_matcher -c "SELECT haplogroup, COUNT(*) as count FROM ystr_profiles GROUP BY haplogroup;"
```

### День 3: Импорт больших баз

```bash
# Подготовка для больших импортов
psql -U postgres -d ystr_matcher <<EOF
ALTER TABLE ystr_profiles DISABLE TRIGGER ALL;
SET work_mem = '256MB';
SET maintenance_work_mem = '1GB';
EOF

# Импорт r1a (18k profiles)
node backend/scripts/import-csv-to-postgres.js --file=scripts/downloads/r1a.csv --haplogroup=R1a

# Импорт I (40k profiles)
node backend/scripts/import-csv-to-postgres.js --file=scripts/downloads/I.csv --haplogroup=I

# Включить триггеры обратно
psql -U postgres -d ystr_matcher -c "ALTER TABLE ystr_profiles ENABLE TRIGGER ALL;"

# Создать индексы
psql -U postgres -d ystr_matcher -c "REINDEX TABLE ystr_profiles;"
psql -U postgres -d ystr_matcher -c "REFRESH MATERIALIZED VIEW marker_statistics;"
```

### День 4: R1b и финализация

```bash
# Импорт R1b chunks (50k+ profiles)
node backend/scripts/import-r1b-chunks.js

# Финальная проверка
psql -U postgres -d ystr_matcher <<EOF
SELECT
    haplogroup,
    COUNT(*) as profiles,
    AVG((SELECT COUNT(*) FROM jsonb_object_keys(markers))) as avg_markers
FROM ystr_profiles
GROUP BY haplogroup
ORDER BY profiles DESC;

SELECT COUNT(*) as total_profiles FROM ystr_profiles;
EOF

# Оптимизация БД
psql -U postgres -d ystr_matcher -c "VACUUM ANALYZE ystr_profiles;"
```

---

## ⚡ Оптимизации производительности

### PostgreSQL Settings

```sql
-- Для импорта больших данных
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET max_worker_processes = 8;
ALTER SYSTEM SET max_parallel_workers = 8;

-- Перезапустить PostgreSQL для применения
-- sudo systemctl restart postgresql
```

### Batch Insert Optimization

```javascript
// Используем bulk_insert_profiles() вместо отдельных INSERT
const batchSize = 5000; // оптимальный размер батча

// BAD (медленно):
for (const profile of profiles) {
  await pool.query('INSERT INTO ystr_profiles ...', [profile]);
}

// GOOD (быстро):
for (let i = 0; i < profiles.length; i += batchSize) {
  const batch = profiles.slice(i, i + batchSize);
  await pool.query('SELECT bulk_insert_profiles($1)', [JSON.stringify(batch)]);
}
```

### Progress Tracking

```javascript
const ProgressBar = require('progress');

const bar = new ProgressBar('Importing [:bar] :percent :etas', {
  total: profiles.length,
  width: 40
});

for (let i = 0; i < profiles.length; i += batchSize) {
  // ... import batch ...
  bar.tick(Math.min(batchSize, profiles.length - i));
}
```

---

## 🔍 Проверка и валидация

### После импорта каждой базы:

```sql
-- 1. Проверить количество профилей
SELECT COUNT(*) FROM ystr_profiles WHERE haplogroup = 'R1a';

-- 2. Проверить среднее количество маркеров
SELECT
    haplogroup,
    AVG((SELECT COUNT(*) FROM jsonb_object_keys(markers))) as avg_markers
FROM ystr_profiles
WHERE haplogroup = 'R1a'
GROUP BY haplogroup;

-- 3. Проверить дубликаты kit_number
SELECT kit_number, COUNT(*)
FROM ystr_profiles
GROUP BY kit_number
HAVING COUNT(*) > 1;

-- 4. Проверить профили без маркеров
SELECT COUNT(*)
FROM ystr_profiles
WHERE jsonb_object_keys(markers) IS NULL;

-- 5. Проверить топ-10 маркеров
SELECT
    key as marker_name,
    COUNT(*) as profiles_with_marker
FROM ystr_profiles, jsonb_object_keys(markers)
WHERE haplogroup = 'R1a'
GROUP BY key
ORDER BY profiles_with_marker DESC
LIMIT 10;
```

---

## 🚨 Troubleshooting

### Проблема: "Duplicate key value violates unique constraint"

**Причина:** Дубликаты kit_number в CSV

**Решение:**
```javascript
// В функции import, перед bulk_insert:
const uniqueProfiles = profiles.reduce((acc, profile) => {
  acc[profile.kitNumber] = profile; // последний wins
  return acc;
}, {});

const deduplicatedProfiles = Object.values(uniqueProfiles);
console.log(`Removed ${profiles.length - deduplicatedProfiles.length} duplicates`);
```

### Проблема: "Out of memory"

**Причина:** Слишком большой batch size

**Решение:**
```javascript
// Уменьшить batch size
const batchSize = 1000; // вместо 5000
```

### Проблема: "Connection timeout"

**Причина:** Долгий импорт

**Решение:**
```javascript
// Увеличить timeout в database.js
const pool = new Pool({
  // ...
  connectionTimeoutMillis: 60000, // 60 секунд
  statement_timeout: 300000, // 5 минут
  query_timeout: 300000
});
```

---

## 📊 Ожидаемый результат

После успешного импорта:

```
╔════════════╦══════════════╦═══════════════╦══════════════╗
║ Haplogroup ║ Profiles     ║ Avg Markers   ║ File Size    ║
╠════════════╬══════════════╬═══════════════╬══════════════╣
║ R1b        ║ ~50,000      ║ 37.5          ║ Chunked JSON ║
║ I          ║ ~40,000      ║ 36.2          ║ 16 MB        ║
║ R1a        ║ ~18,000      ║ 38.1          ║ 6.9 MB       ║
║ E          ║ ~15,000      ║ 35.8          ║ 5.9 MB       ║
║ Others     ║ ~14,000      ║ 34.5          ║ 5.5 MB       ║
║ J2         ║ ~13,000      ║ 36.9          ║ 5.0 MB       ║
║ J1         ║ ~12,000      ║ 37.3          ║ 4.8 MB       ║
║ G          ║ ~8,000       ║ 35.1          ║ 3.2 MB       ║
║ Mixed      ║ ~40          ║ 25.0          ║ 16 KB        ║
╠════════════╬══════════════╬═══════════════╬══════════════╣
║ **TOTAL**  ║ **~170,000** ║ **36.8**      ║ **~47 MB**   ║
╚════════════╩══════════════╩═══════════════╩══════════════╝
```

---

## 🎯 Next Steps

1. ✅ Импорт всех баз (170k profiles)
2. ⏭️ Создать UI для выбора гаплогрупп
3. ⏭️ Оптимизировать поиск (партиционирование)
4. ⏭️ Добавить фильтрацию по множественным гаплогруппам
5. ⏭️ Тестирование производительности

---

**Дата создания:** 2025-10-04
**Автор:** Claude Code
**Версия:** 1.0
