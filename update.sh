#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
APP_DIR="/opt/DNA-utils-universal"
ENV_FILES=(
  ".env"
  ".env.production"
  "ftdna_haplo/.env.development"
  "ftdna_haplo/.env.production"
  "ftdna_haplo/client/.env.development"
  "str-matcher/.env.local"
)
# --- End Configuration ---

cd "$APP_DIR"

echo "Останавливаем PM2 демон и все процессы..."
# This command stops the PM2 daemon itself. It's a robust way to ensure everything is stopped.
# We add '|| true' to prevent the script from exiting if the daemon wasn't running.
pm2 kill || true

# --- Backup .env files ---
echo "Создаем резервные копии .env файлов..."
TEMP_BACKUP_DIR=$(mktemp -d)
for env_file in "${ENV_FILES[@]}"; do
  if [ -f "$env_file" ]; then
    echo "  - Резервное копирование $env_file"
    mkdir -p "$TEMP_BACKUP_DIR/$(dirname "$env_file")"
    cp "$env_file" "$TEMP_BACKUP_DIR/$env_file"
  else
    echo "  - Файл $env_file не найден, пропуск."
  fi
done
# --- End Backup ---

echo "Обновляем код из репозитория..."
git fetch origin
echo "Сбрасываем локальные изменения до состояния origin/main..."
git reset --hard origin/main
echo "Очищаем репозиторий от неотслеживаемых файлов..."
git clean -df

# --- Restore .env files ---
echo "Восстанавливаем .env файлы из резервной копии..."
for env_file in "${ENV_FILES[@]}"; do
  if [ -f "$TEMP_BACKUP_DIR/$env_file" ]; then
    echo "  - Восстановление $env_file"
    cp "$TEMP_BACKUP_DIR/$env_file" "$env_file"
  fi
done
rm -rf "$TEMP_BACKUP_DIR"
# --- End Restore ---

echo "Устанавливаем/обновляем все зависимости..."
npm install
cd str-matcher && npm install && cd ..
cd ftdna_haplo/client && npm install && cd ../..
cd ftdna_haplo/server && npm install && cd ../..

echo "Собираем продакшн-сборку фронтенд приложений..."
npm run build

echo "Перезапускаем все сервисы через PM2..."
npm start

echo "Проверяем статус сервисов через 5 секунд..."
sleep 5
pm2 list

echo "Обновление успешно завершено! Не забудьте выполнить 'pm2 save', если это первая настройка."