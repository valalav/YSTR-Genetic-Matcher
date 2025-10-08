# 🔑 Быстрое создание API ключей

## 3 способа создать API ключ:

---

## ✨ Способ 1: Интерактивный скрипт (РЕКОМЕНДУЕТСЯ)

```bash
node scripts/create-api-key.js
```

Скрипт задаст вопросы и создаст ключ:
- Название ключа
- Описание
- Права доступа (создание, редактирование, удаление)
- Срок действия

**Пример:**
```
🔑 Создание нового API ключа

Введите название ключа: Research Team
Введите описание: Key for researchers
Разрешить создание/обновление? y
Разрешить редактирование? y
Разрешить удаление? n
Срок действия в днях? (Enter = бессрочный):

✅ API ключ создан!
🔑 Ключ: 8e35a79daff73c0ed7664b46ffff0ff0527abb113fc391f76c9a1a3b57c7483a
```

---

## ⚡ Способ 2: Через cURL (быстрый)

```bash
curl -X POST http://localhost:9004/api/admin/keys \
  -H "Content-Type: application/json" \
  -H "X-API-Key: master_dna_2025_ultra_secure_key_change_this_in_production" \
  -d '{
    "name": "My Key",
    "description": "Description here",
    "permissions": {
      "samples.create": true,
      "samples.update": true,
      "samples.delete": false
    }
  }'
```

**Ответ:**
```json
{
  "success": true,
  "apiKey": "8e35a79daff73c0ed7664b46ffff0ff0527abb113fc391f76c9a1a3b57c7483a",
  "keyInfo": { ... }
}
```

---

## 🌐 Способ 3: Через Postman/Insomnia

**URL:** `POST http://localhost:9004/api/admin/keys`

**Headers:**
```
Content-Type: application/json
X-API-Key: master_dna_2025_ultra_secure_key_change_this_in_production
```

**Body:**
```json
{
  "name": "My API Key",
  "description": "Optional description",
  "permissions": {
    "samples.create": true,
    "samples.update": true,
    "samples.delete": false
  },
  "expiresInDays": 365
}
```

---

## 📋 Просмотр всех ключей

```bash
node scripts/list-api-keys.js
```

Или через cURL:
```bash
curl http://localhost:9004/api/admin/keys \
  -H "X-API-Key: master_dna_2025_ultra_secure_key_change_this_in_production"
```

---

## 🗑️ Деактивация ключа

```bash
curl -X DELETE "http://localhost:9004/api/admin/keys/3" \
  -H "X-API-Key: master_dna_2025_ultra_secure_key_change_this_in_production"
```

Для полного удаления добавьте `?permanent=true`:
```bash
curl -X DELETE "http://localhost:9004/api/admin/keys/3?permanent=true" \
  -H "X-API-Key: master_dna_2025_ultra_secure_key_change_this_in_production"
```

---

## 🎯 Использование созданного ключа

### В интерфейсе:
1. Откройте `http://localhost:3000/samples`
2. Введите ваш API ключ
3. Нажмите Login

### В API запросах:
```bash
curl -X POST http://localhost:9004/api/samples \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ВАШ_КЛЮЧ_ЗДЕСЬ" \
  -d '{
    "kitNumber": "12345",
    "name": "Sample Name",
    "haplogroup": "R-M269",
    "markers": {
      "DYS393": "13",
      "DYS390": "24"
    }
  }'
```

---

## 🔐 Текущие ключи

У вас уже есть ключи:

1. **My Research Key** (ID: 3)
   - Ключ: `8e35a79daff73c0ed7664b46ffff0ff0527abb113fc391f76c9a1a3b57c7483a`
   - Права: Создание ✅, Редактирование ✅, Удаление ❌

2. **Test User Key** (ID: 2)
   - Ключ: `c1343595801aa6c0189a7b6bdd521a08a08baa537ca1450a23d711254cbb3fc0`
   - Права: Создание ✅, Редактирование ✅, Удаление ❌

---

## ⚠️ Master Key (только для администратора!)

**НЕ ДЕЛИТЕСЬ ЭТИМ КЛЮЧОМ!**

Master Key: `master_dna_2025_ultra_secure_key_change_this_in_production`

Используется для:
- Создания новых API ключей
- Просмотра/редактирования всех ключей
- Просмотра аудит-лога
- Административных операций

**Измените этот ключ в production!** (файл `backend/.env`)

---

## ❓ Частые вопросы

### Забыл API ключ, как восстановить?
Ключ нельзя восстановить. Создайте новый и деактивируйте старый.

### Как изменить права существующего ключа?
```bash
curl -X PUT http://localhost:9004/api/admin/keys/3 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: master_dna_2025_ultra_secure_key_change_this_in_production" \
  -d '{
    "permissions": {
      "samples.create": true,
      "samples.update": true,
      "samples.delete": true
    }
  }'
```

### Ключ не работает?
Проверьте:
1. Ключ активен? (`node scripts/list-api-keys.js`)
2. Не истек срок действия?
3. Есть ли нужные права?
4. Правильно ли передается заголовок `X-API-Key`?

---

**Готово!** Теперь вы можете создавать и использовать API ключи! 🎉
