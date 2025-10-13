#!/usr/bin/env node

/**
 * Скрипт для создания API ключей
 *
 * Использование:
 *   node scripts/create-api-key.js
 *   node scripts/create-api-key.js --name "Team Key" --no-delete
 */

const readline = require('readline');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:9004';
const MASTER_KEY = process.env.MASTER_API_KEY || 'master_dna_2025_ultra_secure_key_change_this_in_production';

// Parse command line arguments
const args = process.argv.slice(2);
let keyName = null;
let canDelete = true;

args.forEach((arg, index) => {
  if (arg === '--name' && args[index + 1]) {
    keyName = args[index + 1];
  } else if (arg === '--no-delete') {
    canDelete = false;
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createApiKey() {
  console.log('🔑 Создание нового API ключа\n');

  // Get key name
  if (!keyName) {
    keyName = await question('Введите название ключа (например, "Research Team"): ');
  }

  if (!keyName.trim()) {
    console.log('❌ Название обязательно!');
    rl.close();
    return;
  }

  // Get description
  const description = await question('Введите описание (опционально): ');

  // Get permissions
  console.log('\n📋 Права доступа:');
  const canCreate = (await question('Разрешить создание/обновление образцов? (y/n): ')).toLowerCase() === 'y';
  const canUpdate = (await question('Разрешить редактирование образцов? (y/n): ')).toLowerCase() === 'y';

  if (!canDelete) {
    console.log('Удаление образцов: НЕТ (указано через --no-delete)');
  } else {
    canDelete = (await question('Разрешить удаление образцов? (y/n): ')).toLowerCase() === 'y';
  }

  // Get expiration
  const expiresAnswer = await question('\nУстановить срок действия ключа в днях? (Enter = бессрочный): ');
  const expiresInDays = expiresAnswer.trim() ? parseInt(expiresAnswer) : null;

  rl.close();

  // Create API key
  console.log('\n⏳ Создание ключа...');

  const requestBody = {
    name: keyName.trim(),
    description: description.trim(),
    permissions: {
      'samples.create': canCreate,
      'samples.update': canUpdate,
      'samples.delete': canDelete
    }
  };

  if (expiresInDays) {
    requestBody.expiresInDays = expiresInDays;
  }

  try {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(`${BACKEND_URL}/api/admin/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MASTER_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || 'Failed to create key');
    }

    const data = await response.json();

    console.log('\n✅ API ключ успешно создан!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📛 Название: ${data.keyInfo.name}`);
    console.log(`📝 Описание: ${data.keyInfo.description || '(нет)'}`);
    console.log(`🔑 API Ключ: ${data.apiKey}`);
    console.log(`🆔 ID: ${data.keyInfo.id}`);
    console.log(`📅 Создан: ${new Date(data.keyInfo.createdAt).toLocaleString('ru-RU')}`);

    if (data.keyInfo.expiresAt) {
      console.log(`⏰ Истекает: ${new Date(data.keyInfo.expiresAt).toLocaleString('ru-RU')}`);
    } else {
      console.log(`⏰ Истекает: НИКОГДА`);
    }

    console.log('\n🔐 Права доступа:');
    console.log(`   - Создание/обновление: ${data.keyInfo.permissions['samples.create'] ? '✅ ДА' : '❌ НЕТ'}`);
    console.log(`   - Редактирование: ${data.keyInfo.permissions['samples.update'] ? '✅ ДА' : '❌ НЕТ'}`);
    console.log(`   - Удаление: ${data.keyInfo.permissions['samples.delete'] ? '✅ ДА' : '❌ НЕТ'}`);
    console.log('═══════════════════════════════════════════════════════════════');

    console.log('\n⚠️  ВАЖНО: Сохраните ключ в безопасном месте!');
    console.log('⚠️  Он показывается только один раз и не может быть восстановлен!\n');

    console.log('📖 Как использовать ключ:');
    console.log(`   1. В интерфейсе: http://localhost:3000/samples`);
    console.log(`   2. В API запросах: добавьте заголовок "X-API-Key: ${data.apiKey}"\n`);

  } catch (error) {
    console.error('\n❌ Ошибка при создании ключа:', error.message);
    process.exit(1);
  }
}

// Check if node-fetch is available
(async () => {
  try {
    await import('node-fetch');
  } catch (e) {
    console.log('⚠️  Установка node-fetch...');
    const { execSync } = require('child_process');
    execSync('npm install node-fetch@2', { stdio: 'inherit' });
  }

  await createApiKey();
})();
