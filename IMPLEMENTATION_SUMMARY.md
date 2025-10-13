# Отчет о реализации улучшений Sample Manager

## Дата: 2025-10-11

## Выполненные задачи

### 1. ✅ Добавлена функция перезагрузки кэша ("Apply Changes")

#### Бэкенд изменения

**Файл: `~/DNA-utils-universal/backend/routes/admin.js`**

Изменения:
1. Добавлен импорт `requireApiKey` из middleware (строка 5):
```javascript
const { requireApiKey } = require('../middleware/apiKeyAuth');
```

2. Добавлен новый эндпоинт `POST /api/admin/reload-cache` (после строки 408):
```javascript
// POST /api/admin/reload-cache - Reload cache (for Sample Manager)
// Requires API key with cache management permission
router.post('/reload-cache',
  requireApiKey('cache.clear'),
  asyncHandler(async (req, res) => {
    const { type = 'all' } = req.body;
    let clearedCount = 0;
    const clearedTypes = [];

    try {
      if (type === 'all' || type === 'matching') {
        await matchingService.clearMatchingCaches();
        clearedCount++;
        clearedTypes.push('matching');
      }

      if (type === 'all' || type === 'haplogroup') {
        const haplogroupService = require('../services/haplogroupService');
        await haplogroupService.redis.del('haplogroup:tree');
        clearedCount++;
        clearedTypes.push('haplogroup');
      }

      if (type === 'all' || type === 'profiles') {
        const haplogroupService = require('../services/haplogroupService');
        const keys = await haplogroupService.redis.keys('profile:*');
        if (keys.length > 0) {
          await haplogroupService.redis.del(...keys);
        }
        clearedCount++;
        clearedTypes.push('profiles');
      }

      res.json({
        success: true,
        message: `Cache reloaded successfully. Cleared ${clearedCount} cache type(s).`,
        clearedTypes,
        timestamp: new Date().toISOString(),
        apiKey: req.apiKey?.name || 'Unknown'
      });

    } catch (error) {
      console.error('❌ Cache reload error:', error);
      res.status(500).json({
        error: `Cache reload failed: ${error.message}`
      });
    }
  })
);
```

**Расположение файла бэкапа:** `~/DNA-utils-universal/backend/routes/admin.js.bak`

#### Фронтенд изменения

**Файл: `~/DNA-utils-universal/str-matcher/src/components/str-matcher/SampleManager.tsx`**

Изменения:
1. Добавлено состояние для кнопки (строка 51):
```typescript
const [reloadingCache, setReloadingCache] = useState(false);
```

2. Добавлена функция перезагрузки кэша (после строки 263):
```typescript
// Reload cache - clear backend cache and optionally reload page
const reloadCache = useCallback(async () => {
  setReloadingCache(true);
  setMessage(null);

  try {
    const response = await fetch(`${backendUrl}/api/admin/reload-cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ type: 'all' })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || 'Failed to reload cache');
    }

    const data = await response.json();
    setMessage({
      type: 'success',
      text: `✅ ${data.message} Cache types cleared: ${data.clearedTypes.join(', ')}`
    });

    // Optionally reload the page after a short delay to refresh all data
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (error) {
    setMessage({
      type: 'error',
      text: `Failed to reload cache: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  } finally {
    setReloadingCache(false);
  }
}, [apiKey, backendUrl]);
```

3. Добавлена кнопка "Apply Changes" в UI (строка 310):
```typescript
<div className="flex gap-2 mt-2 items-center justify-between">
  <div className="flex gap-2">
    {/* Существующие кнопки Add/Edit/Bulk */}
  </div>
  <Button
    onClick={reloadCache}
    disabled={reloadingCache}
    variant="outline"
    className="bg-green-600 hover:bg-green-700 text-white"
  >
    {reloadingCache ? '🔄 Reloading...' : '🔄 Apply Changes'}
  </Button>
</div>
```

---

### 2. ✅ Создан интерфейс администратора для управления API ключами

**Новый файл: `~/DNA-utils-universal/str-matcher/src/app/admin/keys/page.tsx`**

Полный функционал:

#### Аутентификация
- Вход через мастер-ключ API
- Хранение сессии в sessionStorage
- Безопасный выход

#### Функции управления ключами

**Просмотр всех ключей:**
- Имя ключа (для идентификации владельца)
- Описание
- Статус (Активен/Неактивен/Истёк)
- Список разрешений (badges)
- Дата создания, истечения, последнего использования
- Счётчик использований

**Создание новых ключей:**
- Поле имени (например, "Ключ Ивана Иванова")
- Поле описания (например, "Ключ для работы с историческими образцами")
- Чекбоксы разрешений:
  - `samples.create` - Создание образцов
  - `samples.update` - Обновление образцов
  - `samples.delete` - Удаление образцов
  - `cache.clear` - Очистка кэша
  - `admin.read` - Просмотр данных администратора
- Опциональный срок действия (в днях)
- Показ сгенерированного ключа один раз (с кнопкой копирования)

**Управление существующими ключами:**
- Активация/деактивация ключей
- Удаление ключей (мягкое удаление)
- Просмотр статистики использования
- Визуальные индикаторы для неактивных/истёкших ключей

**Аудит:**
- Все операции логируются с ID API ключа
- Бэкенд отслеживает, какой ключ внёс какие изменения
- Счётчик использований и метка времени последнего использования

---

## Изменённые файлы (с бэкапами)

1. **Backend:**
   - `~/DNA-utils-universal/backend/routes/admin.js`
   - Бэкап: `~/DNA-utils-universal/backend/routes/admin.js.bak`

2. **Frontend:**
   - `~/DNA-utils-universal/str-matcher/src/components/str-matcher/SampleManager.tsx`
   - Бэкап: нет (можно восстановить из Git)

3. **Новые файлы:**
   - `~/DNA-utils-universal/str-matcher/src/app/admin/keys/page.tsx` (новый)

---

## URL для доступа

- **Sample Manager**: https://pystr.valalav.ru/samples
- **Admin Key Management**: https://pystr.valalav.ru/admin/keys

---

## Как использовать

### Для управления образцами:
1. Перейти на `/samples` и ввести API ключ
2. Добавить, отредактировать или массово импортировать образцы
3. После завершения редактирования нажать "🔄 Apply Changes"
4. Кэш очищается и страница автоматически перезагружается со свежими данными

### Для управления API ключами:
1. Перейти на `/admin/keys`
2. Ввести мастер API ключ (из переменной окружения `MASTER_API_KEY`)
3. Создать новые ключи с:
   - Именем для идентификации пользователя
   - Описанием назначения ключа
   - Специфическими разрешениями
   - Опциональным сроком действия
4. Сохранить сгенерированный ключ (показывается только один раз!)
5. Управлять существующими ключами (активировать/деактивировать/удалить)
6. Просматривать статистику использования и аудит

---

## ⚠️ ВАЖНО: Известные проблемы

### Проблема с подключением к базе данных бэкенда

**Статус:** Требует исправления

**Описание:**
Бэкенд сервер (порт 9004) имеет ошибку аутентификации PostgreSQL:
```
Error: password authentication failed for user
Code: 28P01
```

**Где исправить:**
Файл: `~/DNA-utils-universal/backend/.env` или переменные окружения Docker

**Что нужно проверить:**
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ystr_database  # или ваше имя БД
DB_USER=postgres       # или ваш пользователь
DB_PASSWORD=ваш_пароль # ИСПРАВИТЬ
```

**Как запустить бэкенд вручную (для отладки):**
```bash
cd ~/DNA-utils-universal/backend
# Проверить переменные окружения
cat .env

# Запустить сервер
node server.js
```

**Проверка подключения к БД:**
```bash
# Проверить, что PostgreSQL запущен
sudo systemctl status postgresql

# Проверить, что Redis запущен (нужен для кэша)
sudo systemctl status redis
```

---

## Рекомендации по продолжению

### 1. Исправить подключение к базе данных (ПРИОРИТЕТ 1)

```bash
# Шаг 1: Проверить, запущен ли PostgreSQL
sudo systemctl status postgresql

# Шаг 2: Проверить .env файл
cd ~/DNA-utils-universal/backend
cat .env

# Шаг 3: Попробовать подключиться к БД вручную
psql -h localhost -U postgres -d ystr_database

# Шаг 4: Исправить пароль в .env
nano .env
# Изменить DB_PASSWORD на правильный

# Шаг 5: Перезапустить бэкенд
pkill -f "node.*server.js"
nohup node server.js > /tmp/backend.log 2>&1 &

# Шаг 6: Проверить логи
tail -f /tmp/backend.log
```

### 2. Создать первый API ключ (после исправления БД)

```bash
# Использовать curl для создания первого ключа
curl -X POST http://localhost:9004/api/admin/keys \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ваш_мастер_ключ" \
  -d '{
    "name": "Основной ключ администратора",
    "description": "Ключ для управления всеми образцами",
    "permissions": {
      "samples.create": true,
      "samples.update": true,
      "samples.delete": true,
      "cache.clear": true,
      "admin.read": true
    }
  }'
```

### 3. Тестирование функционала

**Тест 1: Перезагрузка кэша**
```bash
# Через curl
curl -X POST http://localhost:9004/api/admin/reload-cache \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ваш_api_ключ" \
  -d '{"type": "all"}'

# Или через интерфейс:
# 1. Зайти на https://pystr.valalav.ru/samples
# 2. Ввести API ключ
# 3. Нажать "🔄 Apply Changes"
```

**Тест 2: Управление ключами**
```bash
# Получить список всех ключей
curl http://localhost:9004/api/admin/keys \
  -H "X-API-Key: мастер_ключ"

# Деактивировать ключ
curl -X PUT http://localhost:9004/api/admin/keys/1 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: мастер_ключ" \
  -d '{"isActive": false}'
```

### 4. Настройка мастер-ключа

Убедитесь, что мастер-ключ установлен в переменных окружения:

```bash
# В файле ~/DNA-utils-universal/backend/.env
echo "MASTER_API_KEY=ваш_безопасный_мастер_ключ" >> .env

# Или в docker-compose.yml
environment:
  - MASTER_API_KEY=ваш_безопасный_мастер_ключ
```

**Рекомендация:** Используйте сложный ключ, например:
```bash
# Сгенерировать безопасный ключ
openssl rand -hex 32
```

### 5. Настройка разрешений для продакшена

После создания первых ключей, рекомендуется:

1. **Создать отдельные ключи для разных пользователей:**
   - Исследователь 1: только `samples.create`, `samples.update`
   - Исследователь 2: только `samples.create`
   - Модератор: все разрешения кроме `admin.read`

2. **Установить сроки действия:**
   - Для временных сотрудников: 90-180 дней
   - Для постоянных: без срока или 365 дней

3. **Регулярно проверять аудит:**
   ```bash
   # Получить аудит-лог (нужно добавить эндпоинт)
   curl http://localhost:9004/api/admin/audit \
     -H "X-API-Key: мастер_ключ"
   ```

---

## Структура проекта

```
~/DNA-utils-universal/
├── backend/
│   ├── routes/
│   │   ├── admin.js              # ✏️ ИЗМЕНЁН (добавлен /reload-cache)
│   │   ├── admin.js.bak          # Бэкап
│   │   ├── keys.js               # Управление ключами (существующий)
│   │   └── samples.js            # CRUD образцов (существующий)
│   ├── middleware/
│   │   └── apiKeyAuth.js         # Аутентификация (существующий)
│   └── server.js                 # Главный сервер
│
└── str-matcher/
    └── src/
        ├── app/
        │   ├── admin/
        │   │   └── keys/
        │   │       └── page.tsx  # ✨ НОВЫЙ (интерфейс управления ключами)
        │   └── samples/
        │       └── page.tsx      # Существующий
        └── components/
            └── str-matcher/
                └── SampleManager.tsx  # ✏️ ИЗМЕНЁН (добавлена кнопка Apply Changes)
```

---

## Технические детали

### API Endpoints

**Новый эндпоинт:**
```
POST /api/admin/reload-cache
Headers: X-API-Key: <api_key_with_cache.clear_permission>
Body: { "type": "all" | "matching" | "haplogroup" | "profiles" }
Response: {
  "success": true,
  "message": "Cache reloaded successfully...",
  "clearedTypes": ["matching", "haplogroup", "profiles"],
  "timestamp": "2025-10-11T...",
  "apiKey": "Key Name"
}
```

**Существующие эндпоинты для ключей:**
```
POST   /api/admin/keys              # Создать ключ
GET    /api/admin/keys              # Список всех ключей
GET    /api/admin/keys/:id          # Детали ключа
PUT    /api/admin/keys/:id          # Обновить ключ
DELETE /api/admin/keys/:id          # Удалить/деактивировать ключ
```

### Разрешения (Permissions)

Доступные разрешения:
- `samples.create` - Создание новых образцов
- `samples.update` - Обновление существующих образцов
- `samples.delete` - Удаление образцов
- `cache.clear` - Очистка кэша приложения
- `admin.read` - Просмотр административных данных и статистики

### Статус приложения

- ✅ Frontend (Next.js): **РАБОТАЕТ** на порту 3000
  - URL: https://pystr.valalav.ru
  - Build ID: успешно собран
  - Все новые страницы включены

- ❌ Backend (Express): **НЕ РАБОТАЕТ** (ошибка подключения к БД)
  - Должен быть на порту 9004
  - Требует исправления конфигурации PostgreSQL

- ❓ PostgreSQL: Статус неизвестен
- ❓ Redis: Статус неизвестен

---

## Контрольный список для запуска

- [ ] Проверить, что PostgreSQL запущен
- [ ] Проверить, что Redis запущен
- [ ] Исправить пароль БД в .env
- [ ] Запустить бэкенд сервер
- [ ] Проверить логи бэкенда
- [ ] Создать первый API ключ через curl
- [ ] Протестировать Sample Manager с кнопкой Apply Changes
- [ ] Протестировать Admin Keys Page
- [ ] Создать ключи для всех пользователей
- [ ] Установить MASTER_API_KEY в безопасное место

---

## Контакты для вопросов

Все изменения задокументированы и код находится на сервере:
- Сервер: valalav@192.168.10.170
- Пароль: 12343211
- Директория проекта: ~/DNA-utils-universal

---

## Дополнительные файлы

**Локальные копии (на сервере с Claude Code):**
- `/tmp/admin.js` - Модифицированный admin.js
- `/tmp/admin_keys_page.tsx` - Страница управления ключами
- `/tmp/SampleManager.tsx` - Модифицированный Sample Manager

**Логи:**
- Next.js: `/tmp/next_prod.log`
- Backend: `/tmp/backend.log` (если запущен)

---

**Дата создания отчёта:** 2025-10-11
**Автор:** Claude (Anthropic)
**Версия:** 1.0
