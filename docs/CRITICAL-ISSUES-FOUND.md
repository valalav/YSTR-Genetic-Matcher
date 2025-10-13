# Critical Issues Found - PostgreSQL YSTR Matcher

**Дата проверки**: 2025-10-05
**Статус**: ⚠️ КРИТИЧЕСКИЕ ПРОБЛЕМЫ ОБНАРУЖЕНЫ

---

## 🔴 КРИТИЧЕСКАЯ ПРОБЛЕМА #1: GIN Index Not Used

### Описание проблемы:

GIN индекс на поле `markers` **НЕ ИСПОЛЬЗУЕТСЯ** в запросах, что приводит к **FULL TABLE SCAN** всех 162,879 профилей при поиске без фильтра по гаплогруппе.

### Симптомы:

```
Производительность БЕЗ фильтра по гаплогруппе:
- Поиск с 3 маркерами: 2,536ms ❌ МЕДЛЕННО
- Поиск с 1 маркером: 1,435ms ❌ МЕДЛЕННО

Производительность С фильтром по гаплогруппе:
- I-M253 (24k профилей): 8ms ✅ БЫСТРО
- E-M35 (10k профилей): 191ms ✅ ПРИЕМЛЕМО
- Много маркеров: 7ms ✅ БЫСТРО
```

### Статистика использования индексов:

```sql
SELECT indexrelname, idx_scan FROM pg_stat_user_indexes
WHERE relname = 'ystr_profiles' ORDER BY idx_scan DESC;
```

```
indexrelname                      | idx_scan
----------------------------------+----------
idx_ystr_profiles_haplogroup      | 3        ← Используется только при фильтре
ystr_profiles_pkey                | 3
idx_ystr_profiles_markers_gin     | 0        ❌ НЕ ИСПОЛЬЗУЕТСЯ!
idx_ystr_profiles_markers_hash    | 0
```

### Причина:

Функция `find_matches_batch()` делает:
1. **Фильтрация по гаплогруппе** (если указан фильтр) → INDEX SCAN ✅
2. **Для КАЖДОГО профиля** вычисляет genetic distance → SEQUENTIAL SCAN ❌
3. **Фильтрует по distance** <= max_distance

Проблема: PostgreSQL не может использовать GIN индекс для JSONB containment, потому что запрос не использует операторы `@>` или `?&`.

### Текущий код функции:

```sql
WITH filtered_profiles AS (
    SELECT p.*
    FROM ystr_profiles p
    WHERE (haplogroup_filter IS NULL
           OR (include_subclades AND p.haplogroup LIKE haplogroup_filter || '%')
           OR (NOT include_subclades AND p.haplogroup = haplogroup_filter))
),
distances AS (
    SELECT
        fp.*,
        calculate_genetic_distance(query_markers, fp.markers, marker_count) as distance
    FROM filtered_profiles fp  -- ❌ ПОЛНЫЙ СКАН ВСЕХ ПРОФИЛЕЙ!
)
SELECT * FROM distances WHERE distance <= max_distance;
```

---

## 🟡 ПРОБЛЕМА #2: Неэффективный расчёт compared_markers

### Описание:

Для каждого профиля выполняется вложенный подзапрос для подсчёта общих маркеров:

```sql
(
    SELECT COUNT(*)
    FROM (
        SELECT k
        FROM jsonb_object_keys(query_markers) k
        WHERE query_markers->>k != '' AND query_markers->>k IS NOT NULL
          AND fp.markers->>k != '' AND fp.markers->>k IS NOT NULL
        LIMIT marker_count
    ) common_markers
)::INTEGER as compared
```

Это выполняется **162,879 раз** при полном скане! Крайне неэффективно.

---

## 🟡 ПРОБЛЕМА #3: Дублирующиеся индексы

### Обнаружено:

```sql
idx_ystr_profiles_kit_number     -- Индекс на kit_number
ystr_profiles_kit_number_key      -- UNIQUE constraint (автоматический индекс)
```

Два индекса на одном поле - один лишний.

То же самое для других таблиц.

---

## ✅ Что работает ХОРОШО:

1. ✅ **API endpoints** - все работают корректно
2. ✅ **Валидация** - пустые маркеры и некорректные данные обрабатываются правильно
3. ✅ **Фильтрация по гаплогруппам** - работает отлично (7-191ms)
4. ✅ **Точность результатов** - genetic distance вычисляется правильно
5. ✅ **Обработка ошибок** - нет crashes, корректные error messages

---

## 📊 Тестовые результаты:

### Все тесты успешны:

```
✅ Test 1: No filter, small distance - 2536ms, 100 matches
✅ Test 2: I-M253 filter (24k profiles) - 8ms, 100 matches
✅ Test 3: E-M35 filter (10k profiles) - 191ms, 100 matches
✅ Test 4: Single marker - 1435ms, 50 matches
✅ Test 5: Many markers - 7ms, 100 matches

Total: 5/5 successful
Average: 835ms
```

### Edge Cases:

```
✅ Empty markers → Validation failed (correct)
✅ Invalid haplogroup → 0 matches (correct)
✅ Very large maxDistance → Validation failed (correct)
```

---

## 🔧 РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЮ

### Критическое (HIGH PRIORITY):

#### 1. Оптимизировать функцию find_matches_batch

**Решение A: Использовать GIN индекс с оператором ?&**

```sql
-- Добавить WHERE условие для использования GIN индекса
WHERE haplogroup_filter IS NULL OR p.haplogroup = haplogroup_filter
  AND p.markers ?& ARRAY(SELECT jsonb_object_keys(query_markers))
```

Это заставит PostgreSQL использовать GIN индекс для предварительной фильтрации профилей, у которых ЕСТЬ нужные маркеры.

**Решение B: Материализованное представление с pre-computed distances**

Для популярных запросов создать materialized view с предвычисленными дистанциями.

**Решение C: Партиционирование таблицы по гаплогруппам**

```sql
CREATE TABLE ystr_profiles_partitioned (
    ...
) PARTITION BY LIST (haplogroup);

CREATE TABLE ystr_profiles_i PARTITION OF ystr_profiles_partitioned
    FOR VALUES IN ('I-M253', 'I-M223', ...);

CREATE TABLE ystr_profiles_r PARTITION OF ystr_profiles_partitioned
    FOR VALUES IN ('R-M198', 'R-M512', ...);
```

#### 2. Оптимизировать calculate_genetic_distance

Переписать функцию для минимизации вызовов jsonb_object_keys:

```sql
CREATE OR REPLACE FUNCTION calculate_genetic_distance_v2(
    markers1 JSONB,
    markers2 JSONB,
    marker_count INTEGER DEFAULT 37
) RETURNS INTEGER
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
    SELECT COUNT(CASE WHEN markers1->k != markers2->k THEN 1 END)::INTEGER
    FROM jsonb_object_keys(markers1) k
    WHERE markers1->>k IS NOT NULL
      AND markers1->>k != ''
      AND markers2->>k IS NOT NULL
      AND markers2->>k != ''
    LIMIT marker_count;
$$;
```

Использовать `LANGUAGE sql` вместо `plpgsql` для лучшей оптимизации.

#### 3. Удалить дублирующиеся индексы

```sql
DROP INDEX IF EXISTS idx_ystr_profiles_kit_number; -- Оставить только UNIQUE constraint
```

### Среднее (MEDIUM PRIORITY):

#### 4. Добавить LIMIT в filtered_profiles CTE

Если не нужно сканировать ВСЮ базу:

```sql
WITH filtered_profiles AS (
    SELECT p.*
    FROM ystr_profiles p
    WHERE ...
    LIMIT 10000  -- Ограничить количество проверяемых профилей
)
```

#### 5. Использовать TABLESAMPLE для очень больших запросов

```sql
FROM ystr_profiles TABLESAMPLE SYSTEM (10) -- 10% от таблицы
```

#### 6. Настроить work_mem для больших сортировок

```sql
SET work_mem = '256MB';  -- Для текущей сессии
```

---

## 📈 Ожидаемые улучшения после оптимизации:

| Сценарий | Текущее | После оптимизации | Улучшение |
|----------|---------|-------------------|-----------|
| Без фильтра, 3 маркера | 2,536ms | ~50-100ms | **25-50x** |
| Без фильтра, 1 маркер | 1,435ms | ~30-60ms | **24-48x** |
| С фильтром (уже быстро) | 7-191ms | 5-50ms | **1.5-4x** |

---

## 🎯 План действий:

### Немедленно (Critical):

1. **Создать оптимизированную версию find_matches_batch_v2** с использованием `?&` оператора
2. **Тестировать на производительность**
3. **Постепенно мигрировать** если результаты хорошие

### Короткий срок (1-2 дня):

4. Оптимизировать calculate_genetic_distance
5. Удалить дублирующиеся индексы
6. Настроить work_mem

### Средний срок (1-2 недели):

7. Рассмотреть партиционирование таблицы
8. Создать materialized views для популярных запросов
9. Добавить мониторинг производительности

---

## 📝 Заключение:

### Статус проекта: ⚠️ ФУНКЦИОНИРУЕТ, НО ТРЕБУЕТ ОПТИМИЗАЦИИ

**Что работает:**
- ✅ Все API endpoints функциональны
- ✅ Валидация и обработка ошибок работают
- ✅ Фильтрация по гаплогруппам ОЧЕНЬ быстрая
- ✅ Результаты точные и корректные

**Критические проблемы:**
- ❌ Поиск БЕЗ фильтра по гаплогруппе медленный (1.4-2.5 секунды)
- ❌ GIN индекс не используется
- ⚠️ Неэффективный подсчёт compared_markers

**Рекомендация:**
Проект ГОТОВ к использованию с обязательной фильтрацией по гаплогруппам. Для производства **НЕОБХОДИМО** оптимизировать запросы для работы без фильтра.

**Приоритет оптимизации:** 🔴 HIGH

---

*Проверено: 2025-10-05*
*Критическая проверка выполнена*
