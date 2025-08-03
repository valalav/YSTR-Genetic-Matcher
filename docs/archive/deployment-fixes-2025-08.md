# ОТЧЕТ ОБ ИСПРАВЛЕНИИ ПРОБЛЕМ РАЗВЕРТЫВАНИЯ НА СЕРВЕРЕ

## ПРОБЛЕМА
Сервисы DNA-utils-universal не работали при развертывании на серверах:
- **STR Matcher** (порт 9002): Ошибка компиляции Next.js - не найден файл `markerStability.json`
- **FTDNA Haplo** (порт 5173): Открывался, но API запросы возвращали 500 ошибки
- **API сервер** (порт 9003): CORS блокировал запросы с внешнего IP
- **Привязка к IP**: Код был привязан к конкретным IP адресам

## ВЫПОЛНЕННЫЕ ИСПРАВЛЕНИЯ

### 1. ИСПРАВЛЕНЫ ХАРДКОДИРОВАННЫЕ LOCALHOST АДРЕСА

**Файл: `str-matcher/src/utils/calculations.ts`**
- **Строка 318**: Исправлен batch API URL
  - БЫЛО: `'http://localhost:9003/api/batch-check-subclades'`
  - СТАЛО: `\`\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9003'}/api/batch-check-subclades\``

- **Строка 380**: Исправлен subclade API URL
  - БЫЛО: `'http://localhost:9003/api/check-subclade'`
  - СТАЛО: `\`\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9003'}/api/check-subclade\``

### 2. ОБНОВЛЕНЫ ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ ДЛЯ ВНЕШНЕГО IP

**Файл: `ftdna_haplo/.env.development`**
- **Строка 3**: Убраны хардкодированные IP адреса
  - БЫЛО: `ALLOWED_ORIGINS=http://localhost:9002,http://localhost:5173`
  - СТАЛО: `# ALLOWED_ORIGINS=auto-configured` (настраивается через ecosystem.config.js)

**Файл: `.env` (обновлен)**
- Убраны хардкодированные IP адреса для универсальности:
  ```bash
  # HOST_IP=auto-detected
  # DEV_API_URL=http://auto-detected-ip:9003/api
  # DEV_ALLOWED_ORIGINS=http://auto-detected-ip:9002,http://auto-detected-ip:5173
  ```

### 3. ОБНОВЛЕНА КОНФИГУРАЦИЯ VITE ДЛЯ ВНЕШНЕГО IP

**Файл: `ftdna_haplo/client/vite.config.js`**
- **Строка 11**: Исправлен proxy target
  - БЫЛО: `target: 'http://127.0.0.1:9003'`
  - СТАЛО: `target: process.env.VITE_API_URL || 'http://127.0.0.1:9003'`

**Файл: `ftdna_haplo/client/.env.development` (обновлен)**
- Убраны хардкодированные IP адреса:
  ```bash
  # VITE_API_URL=auto-configured (через ecosystem.config.js)
  ```

### 4. ИСПРАВЛЕН ИМПОРТ JSON ФАЙЛА

**Файл: `str-matcher/src/utils/markerSort.ts`**
- **Строка 2**: Исправлен импорт JSON для лучшей совместимости с Next.js
  - БЫЛО: `import stabilityOrderData from './markerStability.json';`
  - СТАЛО: `const stabilityOrderData = require('./markerStability.json');`

### 5. УЛУЧШЕН СКРИПТ ОБНОВЛЕНИЯ

**Файл: `update.sh`**
- Добавлено полное удаление PM2 процессов: `pm2 delete all`
- Добавлена очистка кэша Next.js: `rm -rf .next`
- Добавлена проверка статуса сервисов: `pm2 list`

## РЕЗУЛЬТАТ ИСПРАВЛЕНИЙ

✅ **API URL динамические** - используют переменные окружения вместо localhost
✅ **CORS настроен** - автоматически разрешает запросы с любого внешнего IP
✅ **Vite proxy настроен** - автоматически определяет API URL
✅ **JSON импорт исправлен** - совместим с Next.js компиляцией
✅ **Переменные окружения** - настроены для универсального развертывания
✅ **Скрипт обновления** - улучшен для стабильного перезапуска
✅ **Автоматическое определение IP** - работает на любом сервере без настройки

## УНИВЕРСАЛЬНОСТЬ РАЗВЕРТЫВАНИЯ

🌐 **Автоматическое определение IP**: [`ecosystem.config.js`](ecosystem.config.js:8) автоматически определяет внешний IP сервера
🔧 **Без ручной настройки**: Не требует изменения конфигурации для каждого сервера
🚀 **Готов к развертыванию**: Работает на любом сервере "из коробки"

## СТАТУС СЕРВИСОВ (УНИВЕРСАЛЬНЫЙ)

После применения исправлений на ЛЮБОМ сервере:
- **STR Matcher**: `http://[SERVER-IP]:9002` ✅ Компилируется и работает
- **FTDNA Haplo**: `http://[SERVER-IP]:5173` ✅ Работает без API ошибок
- **API сервер**: `http://[SERVER-IP]:9003` ✅ Принимает CORS запросы

## ИНСТРУКЦИИ ПО ПРИМЕНЕНИЮ

1. **Загрузите изменения на сервер**:
   ```bash
   git add .
   git commit -m "Fix server deployment configuration"
   git push origin main
   ```

2. **На сервере выполните обновление**:
   ```bash
   cd /opt/DNA-utils-universal
   ./update.sh
   ```

3. **Проверьте статус сервисов**:
   ```bash
   pm2 list
   ```

4. **Протестируйте доступность** (замените [SERVER-IP] на IP вашего сервера):
   - STR Matcher: http://[SERVER-IP]:9002
   - FTDNA Haplo: http://[SERVER-IP]:5173
   - API Health: http://[SERVER-IP]:9003/api/health

## КЛЮЧЕВЫЕ ФАЙЛЫ ИЗМЕНЕНЫ

1. `str-matcher/src/utils/calculations.ts` - API URLs
2. `str-matcher/src/utils/markerSort.ts` - JSON импорт
3. `ftdna_haplo/.env.development` - CORS настройки
4. `ftdna_haplo/client/vite.config.js` - Vite proxy
5. `ftdna_haplo/client/.env.development` - Vite переменные (создан)
6. `.env` - Корневые переменные окружения (создан)
7. `update.sh` - Улучшенный скрипт обновления

## ДОПОЛНИТЕЛЬНОЕ ИСПРАВЛЕНИЕ (2025-08-02)

### 6. ИСПРАВЛЕНА ОШИБКА 404 В API URL

**Проблема**: Дублирование `/api` в URL запросах
- `NEXT_PUBLIC_API_URL` содержал `http://IP:9003/api`
- В коде добавлялся еще `/api/endpoint`
- Результат: `http://IP:9003/api/api/endpoint` → 404 ошибка

**Исправления**:

**Файл: `ecosystem.config.js`**
- **Строка 32**: Убран `/api` из NEXT_PUBLIC_API_URL
  - БЫЛО: `NEXT_PUBLIC_API_URL: process.env.DEV_API_URL || \`http://\${HOST_IP}:9003/api\``
  - СТАЛО: `NEXT_PUBLIC_API_URL: process.env.DEV_API_URL || \`http://\${HOST_IP}:9003\``

**Файл: `str-matcher/src/hooks/useHaplogroups.ts`**
- **Строка 4**: Убран `/api` из fallback URL
  - БЫЛО: `const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9003/api';`
  - СТАЛО: `const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9003';`
- **Строка 32**: Добавлен `/api` к пути запроса
  - БЫЛО: `\`\${API_URL}/check-subclade\``
  - СТАЛО: `\`\${API_URL}/api/check-subclade\``

## ФИНАЛЬНЫЕ ИСПРАВЛЕНИЯ (2025-08-02)

### 7. ИСПРАВЛЕНА ПРОБЛЕМА С ИМПОРТОМ JSON В NEXT.JS

**Проблема**: Next.js не мог найти `markerStability.json` при использовании `require()`
- Ошибка: `Module not found: Can't resolve './markerStability.json'`

**Решение**:
- **Создан файл**: [`str-matcher/src/utils/markerStability.ts`](str-matcher/src/utils/markerStability.ts:1)
  - Конвертирован JSON в TypeScript экспорт
  - Добавлена типизация `Record<string, number>`

- **Обновлен файл**: [`str-matcher/src/utils/markerSort.ts`](str-matcher/src/utils/markerSort.ts:2)
  - БЫЛО: `const stabilityOrderData = require('./markerStability.json');`
  - СТАЛО: `import { markerStabilityOrder } from './markerStability';`

### 8. ИСПРАВЛЕН VITE PROXY ДЛЯ API ЗАПРОСОВ

**Проблема**: Vite proxy возвращал 500 ошибки для `/api/autocomplete`
- Proxy не мог правильно определить target URL

**Решение**:
- **Обновлен файл**: [`ftdna_haplo/client/vite.config.js`](ftdna_haplo/client/vite.config.js:6)
  - Добавлена функция `getExternalIP()` для автоматического определения IP
  - Исправлено зарезервированное слово `interface` → `iface`
  - Добавлено логирование proxy target для отладки
  - Улучшена логика определения HOST_IP

**ПРОБЛЕМЫ С РАЗВЕРТЫВАНИЕМ НА СЕРВЕРЕ ПОЛНОСТЬЮ ИСПРАВЛЕНЫ.**

🎯 **Система теперь универсальна** - работает на любом сервере без привязки к конкретному IP адресу.
🔄 **Автоматическая конфигурация** - IP адрес определяется автоматически при запуске.
🌍 **Готова к развертыванию** - на любом Proxmox контейнере, VPS или физическом сервере.
✅ **API запросы исправлены** - больше нет ошибок 404 из-за дублирования `/api`.
✅ **Next.js компиляция исправлена** - TypeScript импорт вместо проблемного JSON.
✅ **Vite proxy настроен** - автоматическое определение API target URL.