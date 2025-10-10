# Инструкция по развертыванию в продакшн

## Общая архитектура

Приложение состоит из трех частей:
1. **Frontend (Next.js)** - STR Matcher на порту 3002
2. **Backend API (Express)** - REST API на порту 3001
3. **PostgreSQL Database** - База данных в Docker

---

## Вариант 1: Развертывание на VPS/Dedicated сервере

### Требования к серверу:
- **OS**: Ubuntu 22.04 LTS (рекомендуется) или Debian 11+
- **RAM**: минимум 4GB, рекомендуется 8GB+
- **CPU**: 2+ cores
- **Disk**: минимум 50GB SSD
- **Docker**: версия 20.10+
- **Node.js**: версия 18+ (рекомендуется 20 LTS)

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка необходимых пакетов
sudo apt install -y git curl wget nginx certbot python3-certbot-nginx

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Установка Node.js (через nvm рекомендуется)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Установка PM2 для управления процессами
npm install -g pm2
```

### 2. Клонирование проекта

```bash
cd /opt
sudo git clone https://github.com/your-username/DNA-utils-universal.git
sudo chown -R $USER:$USER DNA-utils-universal
cd DNA-utils-universal
```

### 3. Загрузка больших CSV файлов

#### Опция A: Google Drive (рекомендуется для больших файлов)

1. Загрузите файлы `DB.csv` и `aadna.csv` на Google Drive
2. Сделайте файлы доступными по ссылке
3. Получите прямые ссылки для скачивания:
   - Для Google Drive: используйте формат `https://drive.google.com/uc?export=download&id=FILE_ID`
   - FILE_ID можно взять из ссылки для общего доступа

```bash
# Создайте директорию для данных
mkdir -p /opt/DNA-utils-universal/data

# Скачайте файлы с Google Drive
cd /opt/DNA-utils-universal/data
wget --no-check-certificate 'https://drive.google.com/uc?export=download&id=YOUR_DB_FILE_ID' -O DB.csv
wget --no-check-certificate 'https://drive.google.com/uc?export=download&id=YOUR_AADNA_FILE_ID' -O aadna.csv
```

#### Опция B: Dropbox

```bash
# Получите прямую ссылку (замените ?dl=0 на ?dl=1)
wget -O DB.csv "https://www.dropbox.com/s/YOUR_LINK/DB.csv?dl=1"
wget -O aadna.csv "https://www.dropbox.com/s/YOUR_LINK/aadna.csv?dl=1"
```

#### Опция C: AWS S3 (для корпоративного использования)

```bash
# Установите AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Скачайте файлы
aws s3 cp s3://your-bucket/DB.csv ./data/DB.csv
aws s3 cp s3://your-bucket/aadna.csv ./data/aadna.csv
```

### 4. Настройка PostgreSQL в Docker

```bash
cd /opt/DNA-utils-universal

# Создайте docker-compose.yml для PostgreSQL
cat > docker-compose.yml <<'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: ystr-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ystr_matcher
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    command: >
      postgres
      -c shared_buffers=512MB
      -c effective_cache_size=2GB
      -c maintenance_work_mem=128MB
      -c checkpoint_completion_target=0.9
      -c wal_buffers=16MB
      -c default_statistics_target=100
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
      -c work_mem=32MB
      -c min_wal_size=1GB
      -c max_wal_size=4GB

volumes:
  postgres_data:
    driver: local

EOF

# Создайте .env файл
cat > .env <<'EOF'
POSTGRES_PASSWORD=your_secure_password_here_change_this
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:your_secure_password_here_change_this@localhost:5432/ystr_matcher
EOF

# Запустите PostgreSQL
docker-compose up -d

# Проверьте, что контейнер запустился
docker ps
```

### 5. Инициализация базы данных

```bash
# Создайте схему базы данных
docker exec -i ystr-postgres psql -U postgres -d ystr_matcher <<'EOF'
-- Создание таблицы профилей
CREATE TABLE IF NOT EXISTS ystr_profiles (
    id SERIAL PRIMARY KEY,
    kit_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200),
    country VARCHAR(100),
    haplogroup VARCHAR(50),
    markers JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_kit_number ON ystr_profiles(kit_number);
CREATE INDEX IF NOT EXISTS idx_haplogroup ON ystr_profiles(haplogroup);
CREATE INDEX IF NOT EXISTS idx_country ON ystr_profiles(country);
CREATE INDEX IF NOT EXISTS idx_markers ON ystr_profiles USING GIN (markers);

-- Таблица гаплогрупп
CREATE TABLE IF NOT EXISTS haplogroups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    parent VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица источников гаплогрупп
CREATE TABLE IF NOT EXISTS haplogroup_databases (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Функция для расчета генетической дистанции
CREATE OR REPLACE FUNCTION calculate_genetic_distance(markers1 JSONB, markers2 JSONB)
RETURNS INTEGER AS $$
DECLARE
    distance INTEGER := 0;
    marker_key TEXT;
    val1 TEXT;
    val2 TEXT;
BEGIN
    FOR marker_key IN SELECT jsonb_object_keys(markers1)
    LOOP
        val1 := markers1->>marker_key;
        val2 := markers2->>marker_key;

        IF val1 IS NOT NULL AND val2 IS NOT NULL AND val1 != '' AND val2 != '' THEN
            -- Простое сравнение значений
            IF val1 != val2 THEN
                distance := distance + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN distance;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

EOF

# Обновите скрипт загрузки данных
cd /opt/DNA-utils-universal/scripts

# Отредактируйте load_new_db.py - укажите пути к CSV файлам
sed -i "s|c:\\\\_Data\\\\DNA\\\\Projects\\\\DB\\\\NewDB\\\\DB.csv|/opt/DNA-utils-universal/data/DB.csv|g" load_new_db.py
sed -i "s|c:\\\\_Data\\\\DNA\\\\Projects\\\\DB\\\\NewDB\\\\aadna.csv|/opt/DNA-utils-universal/data/aadna.csv|g" load_new_db.py

# Установите зависимости Python
pip3 install psycopg2-binary

# Загрузите данные (это может занять 10-30 минут)
python3 load_new_db.py
```

### 6. Настройка Backend API

```bash
cd /opt/DNA-utils-universal/backend

# Установите зависимости
npm install --production

# Создайте .env файл
cat > .env <<'EOF'
NODE_ENV=production
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ystr_matcher
DB_USER=postgres
DB_PASSWORD=your_secure_password_here_change_this
CORS_ORIGIN=https://your-domain.com
EOF

# Соберите TypeScript (если используется)
npm run build

# Запустите с PM2
pm2 start npm --name "dna-backend" -- start
pm2 save
pm2 startup
```

### 7. Настройка Frontend (Next.js)

```bash
cd /opt/DNA-utils-universal/str-matcher

# Установите зависимости
npm install --production

# Создайте .env.production
cat > .env.production <<'EOF'
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NODE_ENV=production
EOF

# Соберите приложение
npm run build

# Запустите с PM2
pm2 start npm --name "dna-frontend" -- start -- -p 3002
pm2 save
```

### 8. Настройка Nginx (Reverse Proxy)

```bash
# Создайте конфигурацию Nginx
sudo nano /etc/nginx/sites-available/dna-matcher

# Вставьте следующую конфигурацию:
```

```nginx
# Frontend
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Next.js specific
    location /_next/static/ {
        proxy_pass http://localhost:3002;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }
}

# Backend API
server {
    listen 80;
    server_name api.your-domain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Активируйте конфигурацию
sudo ln -s /etc/nginx/sites-available/dna-matcher /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 9. Настройка SSL (Let's Encrypt)

```bash
# Получите SSL сертификаты
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
sudo certbot --nginx -d api.your-domain.com

# Автообновление сертификатов
sudo certbot renew --dry-run
```

### 10. Настройка автозапуска и мониторинга

```bash
# PM2 уже настроен для автозапуска
pm2 list

# Настройте мониторинг (опционально)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Просмотр логов
pm2 logs dna-backend
pm2 logs dna-frontend
```

---

## Вариант 2: Развертывание на облачных платформах

### Vercel (Frontend только)

1. **Подготовка**:
```bash
cd str-matcher
npm install -g vercel
```

2. **Развертывание**:
```bash
vercel --prod
```

3. **Переменные окружения** (настройте в Vercel Dashboard):
```
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

### Railway.app (Full-stack)

1. Создайте `railway.toml`:
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "pm2-runtime start ecosystem.config.js"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10
```

2. Создайте `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: './backend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
      }
    },
    {
      name: 'frontend',
      cwd: './str-matcher',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      }
    }
  ]
};
```

3. Push to Railway:
```bash
railway up
```

### DigitalOcean App Platform

1. Создайте `app.yaml`:
```yaml
name: dna-str-matcher
services:
  - name: backend
    github:
      repo: your-username/DNA-utils-universal
      branch: main
      deploy_on_push: true
    source_dir: /backend
    build_command: npm install && npm run build
    run_command: npm start
    envs:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        value: ${db.DATABASE_URL}

  - name: frontend
    github:
      repo: your-username/DNA-utils-universal
      branch: main
      deploy_on_push: true
    source_dir: /str-matcher
    build_command: npm install && npm run build
    run_command: npm start
    envs:
      - key: NEXT_PUBLIC_API_URL
        value: https://backend-xxxxx.ondigitalocean.app

databases:
  - name: postgres-db
    engine: PG
    version: "15"
    size: basic-xs
```

---

## Загрузка больших файлов - сравнение сервисов

### 1. **Google Drive** (Рекомендуется)
- ✅ Бесплатно до 15GB
- ✅ Быстрая загрузка
- ✅ Надежность
- ❌ Требует Google аккаунт
- **Как получить прямую ссылку**:
  1. Загрузите файл
  2. Правый клик → "Получить ссылку" → "Доступ для всех в интернете"
  3. Скопируйте ID из ссылки: `https://drive.google.com/file/d/FILE_ID/view`
  4. Используйте: `https://drive.google.com/uc?export=download&id=FILE_ID`

### 2. **Dropbox**
- ✅ Бесплатно до 2GB
- ✅ Простота использования
- ❌ Ограничение размера
- **Прямая ссылка**: замените `?dl=0` на `?dl=1`

### 3. **AWS S3** (Для корпоративного использования)
- ✅ Безлимитный размер
- ✅ Высокая скорость
- ✅ CDN (CloudFront)
- ❌ Платный (~$0.023/GB месяц)
- **Настройка**:
```bash
aws s3 mb s3://dna-data-bucket
aws s3 cp DB.csv s3://dna-data-bucket/ --acl public-read
```

### 4. **GitHub Releases**
- ✅ Бесплатно
- ✅ Версионирование
- ❌ Лимит 2GB на файл
- **Как использовать**:
  1. Создайте релиз
  2. Прикрепите CSV файлы
  3. Используйте прямую ссылку из релиза

### 5. **Mega.nz**
- ✅ Бесплатно до 20GB
- ✅ Шифрование
- ❌ Медленная загрузка
- ❌ Требует megacmd для скачивания

---

## Резервное копирование

### Автоматический backup PostgreSQL

```bash
# Создайте скрипт backup
sudo nano /opt/DNA-utils-universal/scripts/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="ystr_matcher_$DATE.sql"

mkdir -p $BACKUP_DIR

docker exec ystr-postgres pg_dump -U postgres ystr_matcher > "$BACKUP_DIR/$FILENAME"

# Сжатие
gzip "$BACKUP_DIR/$FILENAME"

# Удаление старых backup (старше 7 дней)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $FILENAME.gz"
```

```bash
# Сделайте скрипт исполняемым
chmod +x /opt/DNA-utils-universal/scripts/backup.sh

# Добавьте в crontab (ежедневный backup в 2 AM)
crontab -e
# Добавьте строку:
0 2 * * * /opt/DNA-utils-universal/scripts/backup.sh >> /var/log/postgres_backup.log 2>&1
```

---

## Мониторинг и логи

```bash
# Просмотр логов приложений
pm2 logs

# Просмотр логов PostgreSQL
docker logs ystr-postgres -f

# Просмотр логов Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Мониторинг ресурсов
pm2 monit
docker stats
htop
```

---

## Обновление приложения

```bash
cd /opt/DNA-utils-universal

# Остановите приложения
pm2 stop all

# Получите последние изменения
git pull origin main

# Обновите зависимости и пересоберите
cd backend && npm install && npm run build && cd ..
cd str-matcher && npm install && npm run build && cd ..

# Перезапустите приложения
pm2 restart all

# Проверьте статус
pm2 status
```

---

## Устранение неполадок

### Приложение не отвечает
```bash
pm2 restart all
pm2 logs --lines 100
```

### База данных не подключается
```bash
docker ps
docker logs ystr-postgres
docker restart ystr-postgres
```

### Nginx ошибки
```bash
sudo nginx -t
sudo systemctl status nginx
sudo systemctl restart nginx
```

### Нехватка памяти
```bash
# Проверьте использование памяти
free -h
docker stats

# Настройте swap (если нужно)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Безопасность

### Firewall (UFW)
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

### Fail2Ban
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Обновления безопасности
```bash
# Автоматические обновления
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## Производительность

### Оптимизация PostgreSQL для больших данных

```bash
docker exec -it ystr-postgres psql -U postgres -d ystr_matcher
```

```sql
-- Анализ и вакуум
VACUUM ANALYZE ystr_profiles;

-- Проверка размера таблиц
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Проверка индексов
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) AS size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid::regclass) DESC;
```

---

## Контакты и поддержка

При возникновении проблем:
1. Проверьте логи: `pm2 logs`, `docker logs`
2. Проверьте статус: `pm2 status`, `docker ps`
3. Создайте issue на GitHub с подробным описанием проблемы
