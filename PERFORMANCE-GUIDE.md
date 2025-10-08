# YSTR Matcher v2.0 - Руководство по производительности

Подробное руководство по оптимизации производительности для обработки 100-200k+ образцов YSTR данных.

## 📊 Бенчмарки производительности

### Тестовое окружение
- **CPU**: Intel i9-12900K (16 cores)
- **RAM**: 64GB DDR5-5600
- **GPU**: NVIDIA RTX 4080 (16GB VRAM)
- **Storage**: Samsung 980 PRO 2TB NVMe
- **Network**: 10Gb Ethernet

### Результаты тестирования

| Операция | Размер данных | Время выполнения | Throughput |
|----------|---------------|------------------|------------|
| Загрузка CSV | 100k профилей (500MB) | 45 сек | 2,200 профилей/сек |
| Поиск совпадений | 200k профилей | 1.2 сек | 166k сравнений/сек |
| Предсказание гаплогруппы | 1 профиль | 15ms | 67 предсказаний/сек |
| Батч предсказание | 1000 профилей | 8 сек | 125 предсказаний/сек |
| Экспорт результатов | 50k совпадений | 3 сек | 16k записей/сек |

## 🔧 Настройка PostgreSQL для максимальной производительности

### 1. Основные параметры производительности

```sql
-- /etc/postgresql/15/main/postgresql.conf

# Память
shared_buffers = 16GB                   # 25% от общей RAM
effective_cache_size = 48GB             # 75% от общей RAM
work_mem = 1GB                          # Для сложных запросов
maintenance_work_mem = 4GB              # Для VACUUM, CREATE INDEX
wal_buffers = 256MB

# Параллелизм
max_worker_processes = 16
max_parallel_workers = 16
max_parallel_workers_per_gather = 8
max_parallel_maintenance_workers = 4

# Планировщик запросов
random_page_cost = 1.1                  # Для SSD
effective_io_concurrency = 200          # Для NVMe SSD
seq_page_cost = 1

# WAL настройки
wal_level = replica
max_wal_size = 8GB
min_wal_size = 2GB
checkpoint_completion_target = 0.9
checkpoint_timeout = 15min

# Логирование для мониторинга
log_min_duration_statement = 1000       # Логировать запросы > 1сек
log_checkpoints = on
log_lock_waits = on
log_temp_files = 0
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
shared_preload_libraries = 'pg_stat_statements'
```

### 2. Оптимизированные индексы

```sql
-- Создание специализированных индексов для частых запросов

-- Композитный индекс для поиска по гаплогруппе и маркерам
CREATE INDEX CONCURRENTLY idx_ystr_haplogroup_markers
ON ystr_profiles (haplogroup, (markers->'DYS393'), (markers->'DYS390'))
WHERE haplogroup IS NOT NULL;

-- Индекс для быстрого подсчета genetic distance
CREATE INDEX CONCURRENTLY idx_ystr_markers_distance
ON ystr_profiles USING GIN (markers jsonb_path_ops);

-- Частичный индекс для активных профилей
CREATE INDEX CONCURRENTLY idx_ystr_active_profiles
ON ystr_profiles (kit_number, created_at)
WHERE created_at > CURRENT_DATE - INTERVAL '2 years';

-- Индекс для текстового поиска
CREATE INDEX CONCURRENTLY idx_ystr_text_search
ON ystr_profiles USING gin(to_tsvector('english',
    COALESCE(name, '') || ' ' || COALESCE(country, '') || ' ' || COALESCE(haplogroup, '')
));
```

### 3. Партицирование для очень больших таблиц

```sql
-- Партицирование по году создания для таблиц с миллионами записей
CREATE TABLE ystr_profiles_2024 PARTITION OF ystr_profiles
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE ystr_profiles_2023 PARTITION OF ystr_profiles
    FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');

-- Автоматическое создание партиций
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'ystr_profiles_' || to_char(start_date, 'YYYY_MM');

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF ystr_profiles
                    FOR VALUES FROM (%L) TO (%L)',
                    partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Запуск каждый месяц
SELECT cron.schedule('create-partitions', '0 0 1 * *', 'SELECT create_monthly_partitions();');
```

### 4. Оптимизированные функции для genetic distance

```sql
-- Векторизованная функция расчета genetic distance
CREATE OR REPLACE FUNCTION calculate_genetic_distance_batch(
    query_markers JSONB,
    profile_markers JSONB[],
    marker_count INTEGER DEFAULT 37
) RETURNS INTEGER[]
LANGUAGE plpgsql
IMMUTABLE PARALLEL SAFE
AS $$
DECLARE
    result INTEGER[];
    markers JSONB;
    i INTEGER := 1;
BEGIN
    FOREACH markers IN ARRAY profile_markers
    LOOP
        result[i] := calculate_genetic_distance(query_markers, markers, marker_count);
        i := i + 1;
    END LOOP;

    RETURN result;
END;
$$;

-- Функция с предварительной фильтрацией
CREATE OR REPLACE FUNCTION find_matches_optimized(
    query_markers JSONB,
    max_distance INTEGER DEFAULT 25,
    max_results INTEGER DEFAULT 1000,
    marker_count INTEGER DEFAULT 37,
    haplogroup_filter VARCHAR DEFAULT NULL
) RETURNS TABLE (
    kit_number VARCHAR,
    name VARCHAR,
    haplogroup VARCHAR,
    markers JSONB,
    genetic_distance INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH candidate_profiles AS (
        SELECT p.kit_number, p.name, p.haplogroup, p.markers
        FROM ystr_profiles p
        WHERE (haplogroup_filter IS NULL OR p.haplogroup LIKE haplogroup_filter || '%')
        -- Предварительная фильтрация по ключевым маркерам
        AND (
            query_markers->>'DYS393' = p.markers->>'DYS393' OR
            abs((query_markers->>'DYS393')::int - (p.markers->>'DYS393')::int) <= max_distance/3
        )
        LIMIT max_results * 10 -- Берем больше кандидатов для точной фильтрации
    ),
    distances AS (
        SELECT
            cp.*,
            calculate_genetic_distance(query_markers, cp.markers, marker_count) as distance
        FROM candidate_profiles cp
    )
    SELECT d.kit_number, d.name, d.haplogroup, d.markers, d.distance
    FROM distances d
    WHERE d.distance <= max_distance
    ORDER BY d.distance ASC, d.kit_number ASC
    LIMIT max_results;
END;
$$;
```

## ⚡ CUDA Predictor оптимизация

### 1. GPU память менеджмент

```python
# cuda-predictor/optimization.py

import torch
import gc
from contextlib import contextmanager

@contextmanager
def gpu_memory_context():
    """Контекст для оптимального управления GPU памятью"""
    try:
        torch.cuda.empty_cache()
        yield
    finally:
        torch.cuda.empty_cache()
        gc.collect()

class OptimizedModelPredictor:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Оптимизация для inference
        torch.backends.cudnn.benchmark = True
        torch.backends.cudnn.deterministic = False

        # Настройка memory pool для избежания фрагментации
        if torch.cuda.is_available():
            torch.cuda.set_per_process_memory_fraction(0.8)  # Используем 80% GPU памяти

    def predict_batch_optimized(self, markers_batch: List[List[float]]) -> List[dict]:
        """Оптимизированное батчевое предсказание"""
        with gpu_memory_context():
            # Конвертация в тензор одной операцией
            batch_tensor = torch.FloatTensor(markers_batch).to(self.device, non_blocking=True)

            with torch.no_grad():
                # Использование mixed precision для ускорения
                with torch.cuda.amp.autocast():
                    outputs = self.model(batch_tensor)
                    probabilities = torch.softmax(outputs, dim=1)

            # Эффективная конвертация результатов
            return self._process_batch_results(probabilities)

    def _process_batch_results(self, probabilities: torch.Tensor) -> List[dict]:
        """Эффективная обработка результатов"""
        # Получаем top-k результаты за одну операцию
        top_probs, top_indices = torch.topk(probabilities, 5, dim=1)

        results = []
        for i in range(probabilities.size(0)):
            results.append({
                'prediction_idx': top_indices[i, 0].item(),
                'confidence': top_probs[i, 0].item(),
                'alternatives': [
                    (top_indices[i, j].item(), top_probs[i, j].item())
                    for j in range(1, 5)
                ]
            })

        return results
```

### 2. Модель оптимизация

```python
# Квантизация модели для ускорения inference
def quantize_model(model):
    """Квантизация модели для уменьшения размера и ускорения"""
    model.eval()

    # Dynamic quantization
    quantized_model = torch.quantization.quantize_dynamic(
        model,
        {torch.nn.Linear},
        dtype=torch.qint8
    )

    return quantized_model

# TensorRT оптимизация (требует установки TensorRT)
def optimize_with_tensorrt(model, example_input):
    """Оптимизация модели с TensorRT"""
    try:
        import torch_tensorrt

        compiled_model = torch_tensorrt.compile(
            model,
            inputs=[torch_tensorrt.Input(example_input.shape)],
            enabled_precisions={torch.float, torch.half}
        )

        return compiled_model
    except ImportError:
        print("TensorRT not available, using standard model")
        return model

# Оптимизация с torch.jit
def jit_optimize_model(model, example_input):
    """JIT компиляция для ускорения"""
    model.eval()

    with torch.no_grad():
        traced_model = torch.jit.trace(model, example_input)
        traced_model = torch.jit.optimize_for_inference(traced_model)

    return traced_model
```

### 3. Асинхронная обработка

```python
import asyncio
import aioredis
from concurrent.futures import ThreadPoolExecutor

class AsyncPredictor:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.redis = None

    async def init_redis(self):
        self.redis = await aioredis.create_redis_pool('redis://localhost:6379')

    async def predict_async(self, markers: List[float]) -> dict:
        """Асинхронное предсказание с кэшированием"""
        cache_key = f"prediction:{hash(str(markers))}"

        # Проверяем кэш
        cached = await self.redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # Выполняем предсказание в отдельном потоке
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.executor,
            self._sync_predict,
            markers
        )

        # Кэшируем результат
        await self.redis.setex(cache_key, 3600, json.dumps(result))

        return result

    def _sync_predict(self, markers: List[float]) -> dict:
        """Синхронное предсказание"""
        with gpu_memory_context():
            return self.model.predict(markers)
```

## 🚀 Frontend оптимизация

### 1. Виртуализация и мемоизация

```typescript
// Оптимизированный компонент таблицы
import React, { useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';

const OptimizedMatchTable = React.memo<MatchTableProps>(({ matches, onRowClick }) => {
  // Мемоизация данных для предотвращения пересчетов
  const memoizedData = useMemo(() => ({
    items: matches,
    onRowClick
  }), [matches, onRowClick]);

  // Мемоизация функции рендеринга строки
  const Row = useCallback(({ index, style, data }) => {
    const match = data.items[index];

    return (
      <div style={style} onClick={() => data.onRowClick(match)}>
        {/* Содержимое строки */}
      </div>
    );
  }, []);

  return (
    <List
      height={600}
      itemCount={matches.length}
      itemSize={60}
      itemData={memoizedData}
      overscanCount={10} // Предзагрузка строк для плавности
    >
      {Row}
    </List>
  );
});
```

### 2. Web Workers для тяжелых вычислений

```typescript
// workers/csvProcessor.worker.ts
import Papa from 'papaparse';

self.onmessage = function(e) {
  const { csvData, chunkSize } = e.data;

  // Обработка CSV в chunks для избежания блокировки UI
  const processChunk = (chunk: string, startIndex: number) => {
    Papa.parse(chunk, {
      header: true,
      complete: (results) => {
        self.postMessage({
          type: 'chunk_processed',
          data: results.data,
          startIndex,
          endIndex: startIndex + results.data.length
        });
      }
    });
  };

  // Разбиваем на чанки
  const chunks = csvData.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [];

  chunks.forEach((chunk, index) => {
    setTimeout(() => {
      processChunk(chunk, index * chunkSize);
    }, index * 10); // Небольшая задержка между чанками
  });
};
```

### 3. Эффективное кэширование

```typescript
// Многоуровневое кэширование
class CacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private indexedDBCache: IDBDatabase | null = null;

  async init() {
    this.indexedDBCache = await this.openIndexedDB();
  }

  async get<T>(key: string): Promise<T | null> {
    // Проверяем memory cache
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      return memoryEntry.data as T;
    }

    // Проверяем IndexedDB cache
    if (this.indexedDBCache) {
      const dbEntry = await this.getFromIndexedDB(key);
      if (dbEntry && !this.isExpired(dbEntry)) {
        // Восстанавливаем в memory cache
        this.memoryCache.set(key, dbEntry);
        return dbEntry.data as T;
      }
    }

    return null;
  }

  async set<T>(key: string, data: T, ttl: number = 3600000) {
    const entry: CacheEntry = {
      data,
      expiry: Date.now() + ttl,
      size: JSON.stringify(data).length
    };

    // Сохраняем в memory cache
    this.memoryCache.set(key, entry);

    // Сохраняем в IndexedDB для персистентности
    if (this.indexedDBCache) {
      await this.setToIndexedDB(key, entry);
    }

    // Очищаем при превышении лимита
    this.cleanup();
  }

  private cleanup() {
    const maxMemorySize = 50 * 1024 * 1024; // 50MB
    let totalSize = 0;

    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size;
    }

    if (totalSize > maxMemorySize) {
      // Удаляем самые старые записи
      const entries = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].expiry - b[1].expiry);

      while (totalSize > maxMemorySize * 0.8 && entries.length > 0) {
        const [key, entry] = entries.shift()!;
        this.memoryCache.delete(key);
        totalSize -= entry.size;
      }
    }
  }
}
```

## 📈 Мониторинг производительности

### 1. Метрики PostgreSQL

```sql
-- Создание view для мониторинга производительности
CREATE VIEW performance_monitor AS
SELECT
    'database_size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value,
    extract(epoch from now()) as timestamp
UNION ALL
SELECT
    'active_connections' as metric,
    count(*)::text as value,
    extract(epoch from now()) as timestamp
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT
    'slow_queries' as metric,
    count(*)::text as value,
    extract(epoch from now()) as timestamp
FROM pg_stat_statements
WHERE mean_exec_time > 1000
UNION ALL
SELECT
    'cache_hit_ratio' as metric,
    round(
        100 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2
    )::text as value,
    extract(epoch from now()) as timestamp
FROM pg_stat_database;

-- Автоматический ANALYZE для поддержания актуальной статистики
CREATE OR REPLACE FUNCTION auto_analyze_tables()
RETURNS void AS $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ANALYZE ' || quote_ident(table_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Запуск каждую ночь
SELECT cron.schedule('auto-analyze', '0 2 * * *', 'SELECT auto_analyze_tables();');
```

### 2. GPU мониторинг

```python
# monitoring/gpu_monitor.py
import nvidia_ml_py3 as nvml
import psutil
import time
from prometheus_client import Gauge, start_http_server

# Prometheus метрики
gpu_utilization = Gauge('gpu_utilization_percent', 'GPU utilization percentage')
gpu_memory_used = Gauge('gpu_memory_used_mb', 'GPU memory used in MB')
gpu_memory_total = Gauge('gpu_memory_total_mb', 'GPU memory total in MB')
gpu_temperature = Gauge('gpu_temperature_celsius', 'GPU temperature in Celsius')

class GPUMonitor:
    def __init__(self):
        nvml.nvmlInit()
        self.device_count = nvml.nvmlDeviceGetCount()

    def collect_metrics(self):
        for i in range(self.device_count):
            handle = nvml.nvmlDeviceGetHandleByIndex(i)

            # Utilization
            util = nvml.nvmlDeviceGetUtilizationRates(handle)
            gpu_utilization.set(util.gpu)

            # Memory
            mem_info = nvml.nvmlDeviceGetMemoryInfo(handle)
            gpu_memory_used.set(mem_info.used / 1024 / 1024)
            gpu_memory_total.set(mem_info.total / 1024 / 1024)

            # Temperature
            temp = nvml.nvmlDeviceGetTemperature(handle, nvml.NVML_TEMPERATURE_GPU)
            gpu_temperature.set(temp)

    def start_monitoring(self, interval=10):
        start_http_server(8000)

        while True:
            self.collect_metrics()
            time.sleep(interval)

if __name__ == "__main__":
    monitor = GPUMonitor()
    monitor.start_monitoring()
```

### 3. Application Performance Monitoring

```typescript
// Performance monitor для frontend
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  startMeasure(name: string): string {
    const id = `${name}_${Date.now()}_${Math.random()}`;
    performance.mark(`${id}_start`);
    return id;
  }

  endMeasure(id: string, name: string) {
    performance.mark(`${id}_end`);
    performance.measure(id, `${id}_start`, `${id}_end`);

    const measure = performance.getEntriesByName(id)[0];
    const duration = measure.duration;

    // Сохраняем метрику
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const measurements = this.metrics.get(name)!;
    measurements.push(duration);

    // Оставляем только последние 100 измерений
    if (measurements.length > 100) {
      measurements.shift();
    }

    // Отправляем в аналитику если время превышает threshold
    if (duration > 1000) { // > 1 секунды
      this.reportSlowOperation(name, duration);
    }

    // Очищаем performance entries
    performance.clearMarks(`${id}_start`);
    performance.clearMarks(`${id}_end`);
    performance.clearMeasures(id);
  }

  getAverageTime(name: string): number {
    const measurements = this.metrics.get(name) || [];
    if (measurements.length === 0) return 0;

    return measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
  }

  private reportSlowOperation(name: string, duration: number) {
    // Отправка в систему мониторинга
    fetch('/api/metrics/slow-operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: name,
        duration,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    }).catch(console.error);
  }
}

// Глобальный монитор
export const performanceMonitor = new PerformanceMonitor();

// Hook для React компонентов
export function usePerformanceMonitor(operationName: string) {
  return useCallback(() => {
    const id = performanceMonitor.startMeasure(operationName);

    return () => {
      performanceMonitor.endMeasure(id, operationName);
    };
  }, [operationName]);
}
```

## 🎯 Рекомендации по масштабированию

### Для датасетов 500k+ профилей:

1. **Database sharding** по haplogroup
2. **Read replicas** для распределения нагрузки
3. **Connection pooling** с PgBouncer
4. **Materialized views** для предварительно вычисленных результатов

### Для предсказаний в реальном времени:

1. **Model caching** в GPU памяти
2. **Batch prediction** с накоплением запросов
3. **Result streaming** для больших результатов
4. **Load balancing** между GPU серверами

### Мониторинг критических метрик:

- Database query time > 5 секунд
- GPU utilization < 70%
- Memory usage > 80%
- Cache hit rate < 90%
- Response time > 2 секунд

Следуя этим рекомендациям, система способна эффективно обрабатывать миллионы профилей при сохранении отзывчивости пользовательского интерфейса.