#!/usr/bin/env node

/**
 * Скрипт для просмотра всех API ключей
 *
 * Использование:
 *   node scripts/list-api-keys.js
 *   node scripts/list-api-keys.js --all  (включая неактивные)
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:9004';
const MASTER_KEY = process.env.MASTER_API_KEY || 'master_dna_2025_ultra_secure_key_change_this_in_production';

const includeInactive = process.argv.includes('--all');

(async () => {
  console.log('🔑 Список API ключей\n');

  try {
    const fetch = (await import('node-fetch')).default;

    const url = `${BACKEND_URL}/api/admin/keys${includeInactive ? '?includeInactive=true' : ''}`;
    const response = await fetch(url, {
      headers: {
        'X-API-Key': MASTER_KEY
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error || 'Failed to fetch keys');
    }

    const data = await response.json();

    if (data.keys.length === 0) {
      console.log('📭 Нет API ключей');
      return;
    }

    console.log(`📊 Найдено ключей: ${data.total}\n`);
    console.log('═══════════════════════════════════════════════════════════════');

    data.keys.forEach((key, index) => {
      console.log(`\n#${index + 1} ${key.is_active ? '🟢' : '🔴'} ${key.name}`);
      console.log(`   ID: ${key.id}`);
      console.log(`   Описание: ${key.description || '(нет)'}`);
      console.log(`   Создан: ${new Date(key.created_at).toLocaleString('ru-RU')}`);

      if (key.expires_at) {
        const expired = new Date(key.expires_at) < new Date();
        console.log(`   Истекает: ${new Date(key.expires_at).toLocaleString('ru-RU')} ${expired ? '⚠️ ИСТЕК' : ''}`);
      } else {
        console.log(`   Истекает: НИКОГДА`);
      }

      if (key.last_used_at) {
        console.log(`   Последнее использование: ${new Date(key.last_used_at).toLocaleString('ru-RU')}`);
        console.log(`   Количество использований: ${key.usage_count}`);
      } else {
        console.log(`   Последнее использование: НИКОГДА`);
      }

      const perms = key.permissions || {};
      console.log(`   Права:`);
      console.log(`      - Создание: ${perms['samples.create'] ? '✅' : '❌'}`);
      console.log(`      - Редактирование: ${perms['samples.update'] ? '✅' : '❌'}`);
      console.log(`      - Удаление: ${perms['samples.delete'] ? '✅' : '❌'}`);
    });

    console.log('\n═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
})();
