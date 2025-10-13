# API Configuration Guide

## Критически важная информация о конфигурации API

Этот документ описывает **ЕДИНСТВЕННО ПРАВИЛЬНЫЙ** способ настройки API в проекте DNA-utils-universal. Следование этим инструкциям предотвратит проблемы с проксированием запросов к ftdna-haplo API.

---

## 🔴 ВАЖНО: Два уровня проксирования

В проекте используются **ДВА независимых механизма** проксирования:

### 1. Next.js Rewrites (Приоритет #1)
**Файл:** `str-matcher/next.config.js`

Next.js **ПЕРВЫМ** обрабатывает входящие запросы через `rewrites()`. Это происходит **ДО** того, как запрос попадёт в API routes.

```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: `${process.env.HAPLO_API_URL || 'http://localhost:9003'}/api/:path*`,
    },
  ]
}
```

**Ключевые моменты:**
- ✅ Использует переменную окружения `HAPLO_API_URL`
- ✅ Fallback на `http://localhost:9003` (БЕЗ `/api` на конце!)
- ✅ Добавляет `/api/:path*` в destination
- ❌ **НЕ ИСПОЛЬЗУЙТЕ** другие переменные (`BACKEND_API_URL`, `NEXT_PUBLIC_API_URL`)

### 2. API Route Handler (Резервный, не используется при rewrites)
**Файл:** `str-matcher/src/app/api/[...path]/route.ts`

Этот обработчик выполняется только если rewrites НЕ сработали.

```typescript
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:9003/api'
```

**В нормальной работе этот код НЕ выполняется**, так как Next.js rewrites перехватывают запросы раньше.

---

## 🎯 Правильная конфигурация портов

### Development mode (npm run dev)

```
ftdna-haplo:  http://localhost:9003
str-matcher:  http://localhost:3000
```

**Не требуются переменные окружения** - работает на fallback значениях.

**Файл `.env.local` НЕ НУЖЕН** и **НЕ ДОЛЖЕН СУЩЕСТВОВАТЬ** в `str-matcher/`!

### Production mode (PM2)

```
ftdna-haplo:  http://localhost:9003
str-matcher:  http://localhost:9002
```

**Конфигурация:** `ecosystem.config.js`

```javascript
{
  name: "ftdna-haplo-app",
  env_production: {
    PORT: 9003,  // ← Важно: 9003, не 9004!
  }
},
{
  name: "str-matcher-app",
  env_production: {
    HAPLO_API_URL: "http://localhost:9003"  // ← Без /api на конце!
  }
}
```

---

## ❌ Частые ошибки (чего НЕ делать)

### Ошибка #1: Создание `.env.local` файла
```bash
# ❌ НЕ СОЗДАВАЙТЕ этот файл:
str-matcher/.env.local
```

**Почему:** Next.js кеширует переменные окружения при старте. Изменения в `.env.local` требуют полного перезапуска сервера. Лучше использовать fallback значения в коде.

### Ошибка #2: Неправильное имя переменной
```javascript
// ❌ НЕПРАВИЛЬНО:
process.env.BACKEND_API_URL
process.env.NEXT_PUBLIC_API_URL

// ✅ ПРАВИЛЬНО:
process.env.HAPLO_API_URL
```

### Ошибка #3: Неправильный порт
```javascript
// ❌ НЕПРАВИЛЬНО:
'http://localhost:9004'

// ✅ ПРАВИЛЬНО:
'http://localhost:9003'
```

### Ошибка #4: Лишний /api в fallback
```javascript
// ❌ НЕПРАВИЛЬНО (в next.config.js):
destination: `${process.env.HAPLO_API_URL || 'http://localhost:9003/api'}/:path*`
//                                                                    ^^^^ лишнее!

// ✅ ПРАВИЛЬНО:
destination: `${process.env.HAPLO_API_URL || 'http://localhost:9003'}/api/:path*`
//                                                                   ^^^^^^^^^^^^ добавляется здесь
```

---

## 🔧 Диагностика проблем

### Проблема: "500 Internal Server Error" при запросах к /api/haplogroup-path/*

**Шаг 1: Проверьте ftdna-haplo API напрямую**
```bash
curl http://localhost:9003/api/haplogroup-path/C-Y4541
```

Если возвращает JSON с данными → ftdna-haplo работает ✅

**Шаг 2: Проверьте логи Next.js**

Ищите в консоли:
```
Failed to proxy http://localhost:9004/api/...
```

Если видите порт **9004** вместо **9003** → проблема в `next.config.js`

**Шаг 3: Проверьте next.config.js**
```bash
grep -A3 "rewrites" str-matcher/next.config.js
```

Должно быть:
```javascript
destination: `${process.env.HAPLO_API_URL || 'http://localhost:9003'}/api/:path*`
```

**Шаг 4: Проверьте отсутствие .env.local**
```bash
ls -la str-matcher/.env.local
# Должно вывести: No such file or directory
```

**Шаг 5: Полный перезапуск**
```bash
# Остановите npm run dev (Ctrl+C)
# Убедитесь что процессы убиты:
netstat -ano | findstr :3000
netstat -ano | findstr :9003

# Запустите заново:
npm run dev
```

---

## 📋 Checklist перед запуском

- [ ] Удалён файл `str-matcher/.env.local`
- [ ] В `next.config.js` используется `HAPLO_API_URL`
- [ ] Fallback в `next.config.js` указывает на порт `9003`
- [ ] В `ecosystem.config.js` ftdna-haplo использует порт `9003`
- [ ] В `ecosystem.config.js` str-matcher использует `HAPLO_API_URL`
- [ ] ftdna-haplo запущен и отвечает на `http://localhost:9003/api/`

---

## 🎓 Почему именно так?

### Почему rewrites, а не API route?
Next.js rewrites работают на уровне HTTP сервера, что быстрее и надёжнее, чем проксирование через JavaScript код.

### Почему без /api в fallback?
В rewrites мы добавляем `/api/:path*` в конце destination. Если в fallback уже есть `/api`, получится двойной путь `/api/api/...`

### Почему не использовать .env.local?
Next.js кеширует переменные окружения при старте в production build. В dev mode тоже возможны проблемы с горячей перезагрузкой. Fallback значения в коде более предсказуемы.

### Почему порт 9003, а не 9004?
Исторически ftdna-haplo работает на порту 9003 в dev mode. Порт 9004 использовался в старой версии конфигурации, которая больше не актуальна.

---

## 🔗 Связанные файлы

- `str-matcher/next.config.js` - Основная конфигурация rewrites
- `str-matcher/src/app/api/[...path]/route.ts` - Резервный обработчик (не используется)
- `ecosystem.config.js` - Конфигурация для production (PM2)
- `package.json` - Скрипты для запуска dev mode
- `ftdna_haplo/server/server.js` - Конфигурация ftdna-haplo сервера

---

## 📝 История изменений

**2025-10-04:** Исправлена критическая ошибка в next.config.js
- Изменён порт с 9004 на 9003
- Изменена переменная с `NEXT_PUBLIC_API_URL` на `HAPLO_API_URL`
- Исправлен путь в destination (убран `/api` из fallback)
- Удалён `.env.local` файл
- Обновлён `ecosystem.config.js` для соответствия продакшн конфигурации
