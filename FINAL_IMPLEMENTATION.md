# ✅ Sample Manager - Полная реализация

## Дата завершения: 2025-10-11

---

## 🎯 Что было реализовано

### 1. ✅ Кнопка "Apply Changes" для перезагрузки кэша

**Функционал:**
- После редактирования образцов (добавление, изменение, массовый импорт) пользователь может нажать кнопку "🔄 Apply Changes"
- Кэш на сервере очищается (matching, haplogroup, profiles)
- Страница автоматически перезагружается со свежими данными
- Не нужно перезагружать после каждого изменения - можно накопить несколько правок

**Расположение:**
- Frontend: `~/DNA-utils-universal/str-matcher/src/components/str-matcher/SampleManager.tsx:332-337`
- Backend: `~/DNA-utils-universal/backend/routes/admin.js:410-450`

**API Endpoint:**
```
POST /api/admin/reload-cache
Headers: X-API-Key: <api_key_with_cache.clear_permission>
Body: { "type": "all" | "matching" | "haplogroup" | "profiles" }
```

---

### 2. ✅ Интерфейс управления API ключами для главного администратора

**Функционал:**

#### Аутентификация
- Вход через мастер-ключ API
- Защищённая страница доступна только главному администратору

#### Управление ключами
- **Создание новых ключей** с:
  - Именем (для идентификации владельца, например "Иван Иванов")
  - Описанием (назначение ключа)
  - Гранулярными разрешениями:
    - `samples.create` - Создание образцов
    - `samples.update` - Обновление образцов
    - `samples.delete` - Удаление образцов
    - `cache.clear` - Очистка кэша
    - `admin.read` - Просмотр админ-данных
  - Опциональным сроком действия (в днях)

- **Просмотр всех ключей** с:
  - Именем и описанием
  - Статусом (Активен/Неактивен/Истёк)
  - Списком разрешений
  - Датой создания, истечения, последнего использования
  - Счётчиком использований

- **Управление существующими ключами:**
  - Активация/деактивация
  - Удаление (мягкое удаление)
  - Просмотр статистики

#### Аудит
- Все операции логируются с ID API ключа
- Можно отследить, какой ключ (какой пользователь) внёс какие изменения
- Счётчик использований и временные метки

**Расположение:**
- Frontend: `~/DNA-utils-universal/str-matcher/src/app/admin/keys/page.tsx`
- Backend: `~/DNA-utils-universal/backend/routes/keys.js` (существующий)

---

## 🌐 URL-адреса

| Страница | URL | Требования |
|----------|-----|------------|
| Sample Manager | https://pystr.valalav.ru/samples | API ключ с правами на образцы |
| Admin Keys Management | https://pystr.valalav.ru/admin/keys | Мастер API ключ |
| Backend API | http://localhost:9004 | Внутренний доступ |

---

## 🔑 Мастер API ключ

Текущий мастер-ключ (из .env):
```
master_dna_2025_ultra_secure_key_change_this_in_production
```

**⚠️ ВАЖНО:** Рекомендуется сменить этот ключ в продакшене на более безопасный:
```bash
# Сгенерировать новый безопасный ключ
openssl rand -hex 32

# Обновить в файле
cd ~/DNA-utils-universal/backend
nano .env
# Изменить MASTER_API_KEY на новый ключ
```

---

## 🧪 Тестовый API ключ

Для тестирования был создан ключ с полными правами:
```
Имя: Test Admin Key
Ключ: 8e9713e1214545ff804b02b0482183aeb52ce51baa96fbaea8f7144fa78782ca
Разрешения: samples.create, samples.update, samples.delete, cache.clear, admin.read
```

---

## 📖 Инструкция по использованию

### Для главного администратора

#### 1. Создание API ключей для пользователей

1. Откройте https://pystr.valalav.ru/admin/keys
2. Войдите с мастер-ключом: `master_dna_2025_ultra_secure_key_change_this_in_production`
3. Нажмите "Create New API Key"
4. Заполните форму:
   ```
   Имя: Иван Иванов
   Описание: Ключ для работы с археологическими образцами
   Разрешения: ✓ samples.create, ✓ samples.update
   Срок действия: 365 дней (опционально)
   ```
5. Нажмите "Create Key"
6. **ВАЖНО:** Сохраните сгенерированный ключ - он больше не будет показан!
7. Передайте ключ пользователю Ивану Иванову

#### 2. Управление существующими ключами

- **Просмотр:** Все ключи отображаются в таблице с их статусами
- **Деактивация:** Нажмите на переключатель статуса для временной блокировки
- **Удаление:** Кнопка "Delete" для окончательного удаления
- **Аудит:** Смотрите "Last Used" и "Usage Count" для отслеживания активности

---

### Для пользователей (работа с образцами)

#### 1. Вход в Sample Manager

1. Откройте https://pystr.valalav.ru/samples
2. Введите полученный от администратора API ключ
3. Нажмите "Authenticate"

#### 2. Работа с образцами

**Добавление одного образца:**
1. Нажмите "Add Sample"
2. Заполните форму (Kit Number, Location, Haplogroup, etc.)
3. Нажмите "Save"

**Редактирование образца:**
1. Нажмите "Edit" напротив нужного образца
2. Измените данные
3. Нажмите "Save"

**Массовый импорт:**
1. Нажмите "Bulk Import"
2. Выберите CSV файл с образцами
3. Проверьте предпросмотр
4. Нажмите "Import"

#### 3. Применение изменений

**После всех редактирований:**
1. Нажмите кнопку "🔄 Apply Changes" (справа сверху)
2. Дождитесь сообщения об успехе
3. Страница автоматически перезагрузится с новыми данными

**Примечание:** Можно накопить несколько изменений и применить их одной кнопкой, не нужно нажимать после каждого редактирования.

---

## 🛠️ Техническая документация

### Архитектура решения

```
┌─────────────────────────────────────────────────┐
│          Frontend (Next.js)                     │
│                                                 │
│  /samples - Sample Manager                      │
│    └─ SampleManager.tsx                         │
│       └─ "Apply Changes" button                 │
│                                                 │
│  /admin/keys - API Keys Management              │
│    └─ page.tsx                                  │
│       ├─ Create keys with permissions           │
│       ├─ View all keys with audit info          │
│       └─ Manage keys (activate/delete)          │
└─────────────────────────────────────────────────┘
                     ↓ HTTPS
┌─────────────────────────────────────────────────┐
│          Backend (Express.js)                   │
│                                                 │
│  POST /api/admin/reload-cache                   │
│    └─ Clears matching, haplogroup, profiles     │
│                                                 │
│  POST /api/admin/keys                           │
│    └─ Creates new API key                       │
│                                                 │
│  GET /api/admin/keys                            │
│    └─ Lists all keys with audit info            │
│                                                 │
│  PUT /api/admin/keys/:id                        │
│    └─ Updates key (activate/deactivate)         │
│                                                 │
│  DELETE /api/admin/keys/:id                     │
│    └─ Soft deletes key                          │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│   PostgreSQL Database (Docker)                  │
│                                                 │
│   Tables:                                       │
│   - api_keys (with permissions JSONB)           │
│   - genetic_profiles                            │
│   - haplogroups                                 │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│   Redis Cache (Docker)                          │
│                                                 │
│   Cache keys:                                   │
│   - matching:*                                  │
│   - haplogroup:tree                             │
│   - profile:*                                   │
└─────────────────────────────────────────────────┘
```

---

### API Endpoints

#### 1. Reload Cache

```http
POST /api/admin/reload-cache
Headers: 
  Content-Type: application/json
  X-API-Key: <api_key_with_cache.clear_permission>
Body:
  {
    "type": "all" | "matching" | "haplogroup" | "profiles"
  }

Response 200:
  {
    "success": true,
    "message": "Cache reloaded successfully. Cleared 3 cache type(s).",
    "clearedTypes": ["matching", "haplogroup", "profiles"],
    "timestamp": "2025-10-11T09:18:34.563Z",
    "apiKey": "Test Admin Key"
  }
```

#### 2. Create API Key

```http
POST /api/admin/keys
Headers: 
  Content-Type: application/json
  X-API-Key: <master_api_key>
Body:
  {
    "name": "User Name",
    "description": "Purpose of this key",
    "permissions": {
      "samples.create": true,
      "samples.update": true,
      "samples.delete": false,
      "cache.clear": true,
      "admin.read": false
    },
    "expiresInDays": 365  // optional
  }

Response 200:
  {
    "success": true,
    "message": "API key created successfully...",
    "apiKey": "8e9713e1214545ff...",  // shown only once!
    "keyInfo": {
      "id": 65,
      "name": "User Name",
      "permissions": {...},
      "createdAt": "2025-10-11T09:18:26.216Z",
      "expiresAt": null,
      "isActive": true
    }
  }
```

#### 3. List All Keys

```http
GET /api/admin/keys
Headers: 
  X-API-Key: <master_api_key>

Response 200:
  {
    "success": true,
    "keys": [
      {
        "id": 65,
        "name": "Test Admin Key",
        "description": "Key for testing",
        "permissions": {...},
        "created_at": "2025-10-11T09:18:26.216Z",
        "expires_at": null,
        "is_active": true,
        "last_used_at": "2025-10-11T09:20:00.000Z",
        "usage_count": 5
      },
      ...
    ],
    "total": 21
  }
```

#### 4. Update Key

```http
PUT /api/admin/keys/:id
Headers: 
  Content-Type: application/json
  X-API-Key: <master_api_key>
Body:
  {
    "isActive": false  // or other fields to update
  }

Response 200:
  {
    "success": true,
    "message": "API key updated successfully",
    "key": {...}
  }
```

#### 5. Delete Key

```http
DELETE /api/admin/keys/:id
Headers: 
  X-API-Key: <master_api_key>

Response 200:
  {
    "success": true,
    "message": "API key deleted successfully"
  }
```

---

### Разрешения (Permissions)

| Разрешение | Описание | Используется в |
|-----------|----------|---------------|
| `samples.create` | Создание новых образцов | Sample Manager |
| `samples.update` | Обновление существующих образцов | Sample Manager |
| `samples.delete` | Удаление образцов | Sample Manager |
| `cache.clear` | Очистка кэша (кнопка Apply Changes) | Sample Manager |
| `admin.read` | Просмотр административных данных | Admin endpoints |

---

### Структура файлов

```
~/DNA-utils-universal/
├── backend/
│   ├── routes/
│   │   ├── admin.js              ✏️ ИЗМЕНЁН (+reload-cache endpoint)
│   │   ├── admin.js.bak          (бэкап)
│   │   ├── keys.js               (управление ключами, существующий)
│   │   └── samples.js            (CRUD образцов, существующий)
│   ├── middleware/
│   │   └── apiKeyAuth.js         (аутентификация по API ключу)
│   ├── config/
│   │   └── database.js           (подключение к PostgreSQL)
│   ├── services/
│   │   ├── matchingService.js    (кэш matching)
│   │   └── haplogroupService.js  (кэш haplogroup)
│   ├── .env                      ✏️ ИСПРАВЛЕН (DB_PASSWORD=postgres)
│   └── server.js                 ✅ РАБОТАЕТ (порт 9004)
│
└── str-matcher/
    └── src/
        ├── app/
        │   ├── admin/
        │   │   └── keys/
        │   │       └── page.tsx  ✨ НОВЫЙ (интерфейс управления ключами)
        │   └── samples/
        │       └── page.tsx      (существующий)
        ├── components/
        │   └── str-matcher/
        │       └── SampleManager.tsx  ✏️ ИЗМЕНЁН (+кнопка Apply Changes)
        └── .next/                ✅ ПЕРЕСОБРАН (с новыми изменениями)
```

---

## 🚀 Статус сервисов

### ✅ Backend (Express.js)
- **Статус:** Работает
- **Порт:** 9004
- **База данных:** Подключена (PostgreSQL)
- **Кэш:** Подключен (Redis)
- **Логи:** `/tmp/backend_fixed.log`

### ✅ Frontend (Next.js)
- **Статус:** Работает
- **Порт:** 3000
- **URL:** https://pystr.valalav.ru
- **Сборка:** Актуальная (включены /admin/keys и /samples)
- **Логи:** `/tmp/next_prod.log`

### ✅ PostgreSQL
- **Статус:** Работает (Docker)
- **Порт:** 5432
- **База:** ystr_matcher
- **Контейнер:** ystr-postgres

### ✅ Redis
- **Статус:** Работает (Docker)
- **Порт:** 6379
- **Контейнер:** ystr-redis

---

## 🐛 Известные проблемы

### 1. ⚠️ Haplogroup Tree Warning (некритично)

**Проблема:**
```
❌ Error loading haplogroup tree: recursive query "haplogroup_tree" 
column 4 has type character varying(50)[] in non-recursive term 
but type character varying[] overall
```

**Статус:** Некритично для работы Sample Manager и API Keys
**Влияние:** Не влияет на основной функционал
**Решение:** Может быть исправлено позже, если потребуется работа с haplogroup tree

---

## 🔧 Обслуживание

### Перезапуск сервисов

**Backend:**
```bash
cd ~/DNA-utils-universal/backend
pkill -f "node.*server.js"
nohup node server.js > /tmp/backend.log 2>&1 &
tail -f /tmp/backend.log
```

**Frontend:**
```bash
cd ~/DNA-utils-universal/str-matcher
echo '12343211' | sudo -S fuser -k 3000/tcp
nohup ./node_modules/.bin/next start -p 3000 > /tmp/next_prod.log 2>&1 &
tail -f /tmp/next_prod.log
```

**Проверка здоровья:**
```bash
# Backend health
curl http://localhost:9004/health

# Frontend accessibility
curl https://pystr.valalav.ru/
```

---

### Просмотр логов

```bash
# Backend
tail -f /tmp/backend_fixed.log

# Frontend
tail -f /tmp/next_prod.log

# PostgreSQL (в контейнере)
echo '12343211' | sudo -S docker logs ystr-postgres

# Redis (в контейнере)
echo '12343211' | sudo -S docker logs ystr-redis
```

---

### Резервное копирование

**Бэкапы уже созданы:**
- `~/DNA-utils-universal/backend/routes/admin.js.bak`

**Рекомендуется регулярно делать бэкапы:**
```bash
# Бэкап базы данных
echo '12343211' | sudo -S docker exec ystr-postgres \
  pg_dump -U postgres ystr_matcher > /tmp/ystr_matcher_$(date +%Y%m%d).sql

# Бэкап кода
cd ~/DNA-utils-universal
tar -czf /tmp/dna-utils-backup-$(date +%Y%m%d).tar.gz \
  backend/ str-matcher/src/ --exclude=node_modules --exclude=.next
```

---

## 📊 Примеры использования

### Пример 1: Создание ключа для нового исследователя

```bash
curl -X POST http://localhost:9004/api/admin/keys \
  -H "Content-Type: application/json" \
  -H "X-API-Key: master_dna_2025_ultra_secure_key_change_this_in_production" \
  -d '{
    "name": "Мария Петрова",
    "description": "Ключ для работы с современными образцами, проект 2025",
    "permissions": {
      "samples.create": true,
      "samples.update": true,
      "samples.delete": false,
      "cache.clear": false,
      "admin.read": false
    },
    "expiresInDays": 180
  }'
```

**Результат:**
- Создан ключ с ограниченными правами (только создание и редактирование)
- Ключ истечёт через 180 дней
- Пользователь не может удалять образцы или очищать кэш

---

### Пример 2: Рабочий процесс Sample Manager

```
1. Исследователь получает API ключ от админа
   ↓
2. Заходит на https://pystr.valalav.ru/samples
   ↓
3. Вводит API ключ, нажимает "Authenticate"
   ↓
4. Добавляет 10 новых образцов через форму
   ↓
5. Импортирует CSV с 50 образцами
   ↓
6. Редактирует 3 образца (исправляет опечатки)
   ↓
7. Нажимает "🔄 Apply Changes"
   ↓
8. Кэш очищается, страница перезагружается
   ↓
9. Все изменения видны в системе
```

**Важно:** Кнопку "Apply Changes" нужно нажимать только после завершения всех правок, а не после каждой операции.

---

### Пример 3: Аудит использования ключей

```bash
# Получить список всех ключей с аудитом
curl -s http://localhost:9004/api/admin/keys \
  -H "X-API-Key: master_dna_2025_ultra_secure_key_change_this_in_production" \
  | python3 -m json.tool

# Результат покажет для каждого ключа:
# - usage_count: сколько раз использовался
# - last_used_at: когда последний раз использовался
# - created_at: когда создан
# - name: кто владелец
```

---

## 🎓 Рекомендации по безопасности

### 1. Управление мастер-ключом

- ✅ Храните мастер-ключ в безопасном месте
- ✅ Регулярно меняйте мастер-ключ (раз в 6 месяцев)
- ✅ Не делитесь мастер-ключом с обычными пользователями
- ✅ Используйте сложный ключ (минимум 32 символа)

### 2. Создание пользовательских ключей

- ✅ Выдавайте минимально необходимые разрешения
- ✅ Устанавливайте срок действия для временных сотрудников
- ✅ Используйте понятные имена для идентификации владельцев
- ✅ Записывайте, кому и когда выдали ключ (внешний учёт)

### 3. Мониторинг

- ✅ Регулярно проверяйте `usage_count` и `last_used_at`
- ✅ Деактивируйте неиспользуемые ключи
- ✅ Удаляйте ключи уволившихся сотрудников
- ✅ Проверяйте логи на подозрительную активность

### 4. Резервное копирование

- ✅ Делайте бэкапы базы данных ежедневно
- ✅ Храните бэкапы в безопасном месте
- ✅ Тестируйте восстановление из бэкапов
- ✅ Бэкапы кода должны включать .env файлы (в зашифрованном виде)

---

## ✅ Контрольный список запуска

- [x] PostgreSQL запущен и доступен
- [x] Redis запущен и доступен
- [x] Пароль БД исправлен в .env (postgres)
- [x] Backend сервер запущен на порту 9004
- [x] Backend подключён к PostgreSQL
- [x] Backend подключён к Redis
- [x] Эндпоинт /api/admin/reload-cache работает
- [x] Frontend собран с последними изменениями
- [x] Next.js сервер запущен на порту 3000
- [x] Страница /samples доступна
- [x] Страница /admin/keys доступна
- [x] Кнопка "Apply Changes" добавлена в Sample Manager
- [x] Мастер API ключ настроен
- [x] Создан тестовый API ключ с полными правами

---

## 📞 Поддержка

**В случае проблем:**

1. Проверьте логи:
   ```bash
   tail -f /tmp/backend_fixed.log
   tail -f /tmp/next_prod.log
   ```

2. Проверьте статус сервисов:
   ```bash
   curl http://localhost:9004/health
   curl https://pystr.valalav.ru/
   echo '12343211' | sudo -S docker ps
   ```

3. Перезапустите сервисы (см. раздел "Обслуживание")

---

## 🎉 Заключение

Все запрошенные функции успешно реализованы и протестированы:

1. ✅ **Кнопка "Apply Changes"** - позволяет применить накопленные изменения одним действием
2. ✅ **Интерфейс управления API ключами** - полный контроль над ключами с аудитом
3. ✅ **Система разрешений** - гранулярный контроль доступа для каждого пользователя
4. ✅ **Аудит действий** - отслеживание, кто и когда вносил изменения

Система готова к использованию!

---

**Версия документа:** 1.0  
**Дата:** 2025-10-11  
**Автор:** Claude (Anthropic)  
**Проект:** DNA-utils-universal / STR Matcher
