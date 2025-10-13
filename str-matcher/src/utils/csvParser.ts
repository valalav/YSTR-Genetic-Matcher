import type { STRProfile } from '@/utils/constants';
import { markers } from '@/utils/constants';

export const parseCSVData = async (csvText: string): Promise<STRProfile[]> => {
  try {
    // Разбиваем текст на строки и фильтруем пустые
    const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 1) throw new Error('CSV file is empty or invalid');

    // Парсим заголовки
    const headers = lines[0].split(/\t|,/).map(h => h.trim().replace(/"/g, ''));
    console.log('📋 Заголовки CSV:', headers);

    // Определяем индексы колонок
    const kitNumberAliases = ['kit number', 'kit no', 'kit', 'id', 'number', 'kitnumber'];
    const kitIndex = headers.findIndex(h => kitNumberAliases.includes(h.toLowerCase()));
    console.log(`🔍 Индекс колонки kitNumber: ${kitIndex} (заголовок: "${headers[kitIndex]}")`);

    if (kitIndex === -1) {
      console.warn('⚠️ Колонка kitNumber не найдена! Доступные заголовки:', headers);
    }
    const nameIndex = headers.findIndex(h => 
      h.toLowerCase() === 'name' || 
      h.toLowerCase().includes('paternal')
    );
    const countryIndex = headers.findIndex(h => 
      h.toLowerCase() === 'country' || 
      h.toLowerCase().includes('origin')
    );
    const haplogroupIndex = headers.findIndex(h => 
      h.toLowerCase().includes('haplo') || 
      h.toLowerCase() === 'subclade'
    );

    // Проверяем наличие хотя бы ID/Kit колонки или маркеров
    const hasMarkers = headers.some(h => markers.includes(h));
    if (kitIndex === -1 && !hasMarkers) {
      throw new Error('No kit number column or markers found');
    }

    // Создаем профили
    const profiles: STRProfile[] = [];
    let profileCounter = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/\t|,/).map(v => v.trim());

      const actualKitNumber = kitIndex >= 0 ? values[kitIndex] : '';

      // 🐛 Дебаг: выводим первые 3 профиля
      if (i <= 3) {
        console.log(`📝 Строка ${i}:`, {
          kitIndex,
          actualKitNumber,
          'values[kitIndex]': values[kitIndex],
          firstFewValues: values.slice(0, 5)
        });
      }

      const profile: STRProfile = {
        kitNumber: actualKitNumber || `AUTO_${++profileCounter}`,
        markers: {}
      };

      if (nameIndex >= 0) profile.name = values[nameIndex];
      if (countryIndex >= 0) profile.country = values[countryIndex];
      if (haplogroupIndex >= 0) profile.haplogroup = values[haplogroupIndex];

      // Собираем маркеры
      headers.forEach((header, index) => {
        if (markers.includes(header) && values[index]) {
          profile.markers[header] = values[index];
        }
      });

      // Добавляем профиль только если есть маркеры
      if (Object.keys(profile.markers).length > 0) {
        profiles.push(profile);
      }
    }

    if (profiles.length === 0) {
      throw new Error('No valid profiles found in CSV');
    }

    return profiles;

  } catch (error) {
    console.error('Error parsing CSV:', error);
    throw error;
  }
};