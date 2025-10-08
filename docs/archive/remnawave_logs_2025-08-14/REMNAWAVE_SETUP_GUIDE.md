# RemnaWave VPN - Полная инструкция по настройке и управлению

## 📊 Текущий статус системы (обновлено 11.08.2025)

### ✅ Что уже работает:
1. **RemnaWave Panel** - веб-панель управления
   - URL: https://remna.valalav.ru
   - Статус: ✅ Запущен и работает 10+ часов
   - Порт: 3000 (проксируется через nginx)
   - HTTP статус: 200 OK

2. **База данных PostgreSQL** 
   - Контейнер: remnawave-db
   - Статус: ✅ Работает
   - База: postgres
   - Таблица nodes: ✅ Создана
   - Нода в БД: ✅ Oracle_Node_01 уже создана

3. **Redis Cache**
   - Контейнер: remnawave-redis  
   - Статус: ✅ Работает

4. **Nginx Reverse Proxy**
   - Контейнер: nginx-proxy_nginx_1
   - Статус: ✅ Работает 26+ часов
   - SSL: ✅ Действующий сертификат Let's Encrypt

5. **Docker Networks**
   - remnawave-network: ✅ Создана
   - common-net: ✅ Создана
   - nginx-proxy_default: ✅ Создана

### ⚠️ Требует завершения настройки:
- **RemnaNode** - исполнительный узел VPN
  - Статус: ❌ Не запущен
  - Проблема: Требуется SSL_CERT из панели управления
  - docker-compose.yml: ✅ Создан и настроен
  - .env файл: ⚠️ Создан, но нужен правильный SSL_CERT

## 🔐 SSH Подключение к серверу - ИСПРАВЛЕННЫЕ МЕТОДЫ

### Метод 1: Использование Plink (рекомендуется для Windows)
```batch
c:\_Data\Soft\Linux\WSA\1\plink.exe -ssh -i c:\_Data\Soft\Linux\WSA\1\Oracle22.ppk -hostkey "ssh-ed25519 255 SHA256:Mei3MfHG0QQmQRDt5ejF0bhqu09dSaaZL+xWMReEuXM" ubuntu@130.61.157.122
```

### Метод 2: Создание BAT файла для быстрого подключения
Создайте файл `connect_remnawave.bat` в `c:\projects\DNA-utils-universal\`:
```batch
@echo off
echo Connecting to RemnaWave Server...
c:\_Data\Soft\Linux\WSA\1\plink.exe -ssh -i c:\_Data\Soft\Linux\WSA\1\Oracle22.ppk -hostkey "ssh-ed25519 255 SHA256:Mei3MfHG0QQmQRDt5ejF0bhqu09dSaaZL+xWMReEuXM" ubuntu@130.61.157.122
```

### Метод 3: Использование OpenSSH (если установлен)
```powershell
# Сначала конвертируйте PPK в OpenSSH формат с помощью PuTTYgen
# Затем используйте:
ssh -i ~/.ssh/Oracle22 ubuntu@130.61.157.122
```

### Метод 4: Использование PuTTY
1. Откройте PuTTY
2. Host Name: `130.61.157.122`
3. Port: `22`
4. Connection > SSH > Auth > Private key: выберите `Oracle22.ppk`
5. Сохраните сессию как "RemnaWave" для быстрого доступа

## 🚨 КРИТИЧЕСКИ ВАЖНО: Получение SSL_CERT

### ⚠️ Текущая проблема:
RemnaNode требует специальный SSL_CERT, который может быть получен ТОЛЬКО через веб-интерфейс панели управления. Все попытки создать сертификат вручную (API токен, JWT, SSL сертификат) не проходят валидацию.

### ✅ Решение - получите SSL_CERT через веб-интерфейс:

1. **Откройте браузер** и перейдите на https://remna.valalav.ru

2. **Войдите в панель** с учетными данными:
   ```
   Username/Email: admin@remnawave.app
   Пароль: remnawave
   ```
   **ВАЖНО**: Сразу смените пароль после первого входа!

3. **В панели управления найдите существующую ноду:**
   - Перейдите в раздел "Nodes" / "Узлы" / "Серверы"
   - Найдите ноду "Oracle_Node_01" (она уже создана в БД)
   - Нажмите на нее для просмотра деталей

4. **Получите SSL сертификат для ноды:**
   - В деталях ноды найдите кнопку "Generate Certificate" / "Сгенерировать сертификат"
   - Или "Show Certificate" / "Показать сертификат"
   - Или создайте новую ноду если нужно:
     - Name: Oracle-Node
     - Address: remna_node_app
     - Port: 4222

5. **Скопируйте SSL_CERT** - это будет длинная строка (обычно начинается с eyJ...)

6. **Добавьте сертификат в конфигурацию ноды:**
```bash
# Подключитесь к серверу используя один из методов выше
# Затем выполните:

# Откройте файл для редактирования
sudo nano /opt/RemnaNode/.env

# Файл должен выглядеть так:
# RemnaNode Configuration
NODE_NAME=Oracle-Node
PANEL_URL=https://remna.valalav.ru
NODE_PORT=4222
SSL_CERT=ВСТАВЬТЕ_СЮДА_СКОПИРОВАННЫЙ_СЕРТИФИКАТ
LOG_LEVEL=info
MAX_CONNECTIONS=1000

# Сохраните: Ctrl+O, Enter, Ctrl+X

# Запустите RemnaNode
cd /opt/RemnaNode
docker-compose up -d

# Проверьте статус
docker ps | grep remna_node
docker logs remna_node_app --tail 20
```

## 📋 Текущая конфигурация системы

### Файл /opt/RemnaNode/docker-compose.yml (уже создан):
```yaml
services:
  remna_node_app:
    image: remnawave/node:latest
    container_name: remna_node_app
    hostname: remna_node_app
    restart: always
    env_file: [ .env ]
    volumes:
      - ./xray-config:/xray-config
      - ./geodata:/geodata
      - remna-node-data:/data
    networks:
      - remnawave-network
      - common-net
    extra_hosts:
      - "remna.valalav.ru:172.18.0.4"  # IP контейнера remnawave
    environment:
      - PANEL_URL=https://remna.valalav.ru
      - NODE_PORT=4222
      - XRAY_CONFIG_PATH=/xray-config
      - GEODATA_PATH=/geodata

volumes:
  remna-node-data:
    driver: local

networks:
  remnawave-network:
    external: true
  common-net:
    external: true
```

### База данных - существующие записи:
- **Нода в БД**: Oracle_Node_01 | remna_node_app | port: 4222 | is_connected: false
- **API токен**: Создан токен "Oracle_Node_01_Token" (но не подходит как SSL_CERT)

## 🔧 Полезные команды для диагностики

### Проверка статуса всех компонентов:
```bash
# Статус всех контейнеров RemnaWave
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "remna|nginx|redis|postgres"

# Проверка логов панели на ошибки
docker logs remnawave --tail 50 | grep -i error

# Проверка подключения ноды в БД
docker exec remnawave-db psql -U postgres -d postgres -t -c "SELECT name, is_connected, last_status_message FROM nodes;"

# Проверка сетей Docker
docker network ls | grep -E "remnawave|common|nginx"

# IP адреса контейнеров
docker inspect remnawave -f '{{range .NetworkSettings.Networks}}{{.NetworkID}} -> {{.IPAddress}}{{end}}'
```

### После успешного запуска RemnaNode:
```bash
# Проверка что нода работает
docker ps | grep remna_node
docker logs remna_node_app --tail 50

# Проверка подключения к панели
docker exec remna_node_app curl -s http://remnawave:3000/health

# Мониторинг в реальном времени
docker logs -f remna_node_app
```

## ⛔ Частые ошибки и их решения

### Ошибка: "Invalid SSL certificate payload"
**Причина**: Неправильный формат SSL_CERT
**Решение**: Получите сертификат через веб-интерфейс панели, НЕ пытайтесь создать его вручную

### Ошибка: "502 Bad Gateway" 
**Причина**: Контейнер remnawave не запущен
**Решение**:
```bash
cd /opt/RemnaWave
docker-compose up -d remnawave
docker network connect nginx-proxy_default remnawave
```

### Ошибка: "Network remnawave-network not found"
**Решение**:
```bash
docker network create remnawave-network
docker network create common-net
```

### Ошибка SSH: "Server refused our key"
**Решение**: Используйте правильный путь к ключу и добавьте -hostkey параметр как показано выше

## 📁 Структура файлов на сервере

```
/opt/
├── RemnaWave/              # Панель управления
│   ├── docker-compose.yml  # ✅ Настроен
│   ├── .env               # ✅ Настроен (DATABASE_URL и др.)
│   └── data/              # Данные приложения
│
├── RemnaNode/             # VPN нода
│   ├── docker-compose.yml # ✅ Создан и настроен
│   ├── .env              # ⚠️ Требует SSL_CERT из панели
│   ├── geodata/          # ✅ Директория создана
│   └── xray-config/      # ✅ Директория создана

~/nginx-proxy/             # Reverse proxy
├── docker-compose.yml     # ✅ Настроен
├── nginx/
│   └── conf.d/
│       └── remna.valalav.ru.conf # ✅ Настроен
└── certbot/              # ✅ SSL сертификаты активны
```

## 🎯 Следующие шаги после получения SSL_CERT

1. **Добавьте SSL_CERT в /opt/RemnaNode/.env**
2. **Запустите RemnaNode**: `cd /opt/RemnaNode && docker-compose up -d`
3. **Проверьте подключение в панели управления**
4. **Создайте VPN профили для пользователей**
5. **Настройте правила маршрутизации если нужно**

## 📞 Контакты и ресурсы

- **Панель управления**: https://remna.valalav.ru
- **Документация RemnaWave**: https://remna.st/docs
- **IP сервера**: 130.61.157.122
- **SSH пользователь**: ubuntu
- **Локальный проект**: c:\projects\DNA-utils-universal\

## 🔄 История обновлений

- **11.08.2025 19:45** - Обновлен документ после диагностики системы
- **11.08.2025 18:00** - Создана конфигурация RemnaNode
- **11.08.2025** - Первоначальная установка RemnaWave Panel
- **RemnaWave Panel версия**: v2.0.8

---
*Последнее обновление: 11.08.2025 19:45*
*Автор: RemnaWave Setup Assistant*