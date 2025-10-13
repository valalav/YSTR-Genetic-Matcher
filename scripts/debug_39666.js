const fs = require('fs');
const path = require('path');

// Parse CSV line handling quoted values
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map(v => v.replace(/"/g, ''));
}

// Read AADNA CSV and find kit 39666
const csvPath = path.join(__dirname, 'downloads', 'aadna.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n').filter(line => line.trim());

// Parse headers
const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
console.log('Headers:', headers);
console.log('Total headers:', headers.length);

// Find line with 39666
for (let i = 1; i < lines.length; i++) {
  if (lines[i].includes('39666')) {
    console.log(`\nFound kit 39666 at line ${i + 1}:`);
    console.log('Raw line:', lines[i]);

    const values = parseCSVLine(lines[i]);
    console.log('Parsed values:', values);
    console.log('Total values:', values.length);

    const profile = {};
    const markers = {};

    for (let j = 0; j < headers.length && j < values.length; j++) {
      const header = headers[j];
      const value = values[j].trim();

      console.log(`Column ${j}: "${header}" = "${value}"`);

      // Identify profile fields vs markers
      const lowerHeader = header.toLowerCase();
      if (lowerHeader.includes('kit') || lowerHeader === 'id' || lowerHeader === 'number') {
        console.log(`  -> Setting kitNumber = "${value}"`);
        profile.kitNumber = value;
      } else if (lowerHeader.includes('name') || lowerHeader === 'name') {
        console.log(`  -> Setting name = "${value}"`);
        profile.name = value;
      } else if (lowerHeader.includes('country') || lowerHeader.includes('страна')) {
        console.log(`  -> Setting country = "${value}"`);
        profile.country = value;
      } else if (lowerHeader.includes('haplo') || lowerHeader.includes('гаплогруппа')) {
        console.log(`  -> Setting haplogroup = "${value}"`);
        profile.haplogroup = value;
      } else if (value && value !== '' && value !== '-' && !isNaN(parseFloat(value))) {
        console.log(`  -> Setting marker ${header} = "${value}"`);
        markers[header] = value;
      }
    }

    console.log('\nFinal profile:', profile);
    console.log('Final markers:', markers);
    console.log('Marker count:', Object.keys(markers).length);

    // Check if profile would be added
    if (profile.kitNumber && Object.keys(markers).length > 0) {
      console.log('\n✅ Profile would be added to database');
    } else {
      console.log('\n❌ Profile would NOT be added to database');
      console.log('  - Has kitNumber:', !!profile.kitNumber);
      console.log('  - Has markers:', Object.keys(markers).length > 0);
    }

    break;
  }
}