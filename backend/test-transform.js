const fs = require('fs');
const Papa = require('papaparse');

// Read and parse CSV
const csvContent = fs.readFileSync('../scripts/downloads/aadna.csv', 'utf-8');
const parseResult = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (header) => header.trim(),
  transform: (value) => value.trim()
});

// Extract markers function (simplified)
function extractMarkers(row) {
  const markers = {};
  const excludeKeys = ['kitnumber', 'kit_number', 'kit number', 'kitno', 'name', 'fullname', 'full_name', 'country', 'location', 'haplogroup', 'haplo', 'clade', 'source', 'project', 'database', 'фамилия', 'lacation', 'широта', 'долгота', 'субэтнос', 'гг1', 'гг2', 'гг3', 'гг4', 'гг5', 'ftdna hg', 'yfull', 'ftdna tree link', 'yfull_tree', 'mtdna', 'lab', '№', 'paternal ancestor name'];
  Object.keys(row).forEach(key => {
    const lowerKey = key.toLowerCase().trim();
    if (!excludeKeys.includes(lowerKey)) {
      const value = row[key]?.toString().trim();
      if (value && value !== '' && value !== '0' && value !== '-') {
        markers[key] = value;
      }
    }
  });
  return markers;
}

// Transform function
function transformRow(row, defaultHaplogroup) {
  const profile = {
    kit_number: row.kitNumber || row.kit_number || row.KitNumber || row['Kit Number'] || row.kitno || row.KitNo || row['-'],
    name: row.name || row.Name || row.fullname || row.FullName || row.full_name || row['Full Name'] || '',
    country: row.country || row.Country || row.location || row.Location || row.Lacation || '',
    haplogroup: row.haplogroup || row.Haplogroup || row.Haplo || row.clade || row.Clade || row['FTDNA HG'] || row.Yfull || defaultHaplogroup || '',
    markers: extractMarkers(row)
  };
  return profile;
}

// Find and transform row 55520
const row55520 = parseResult.data.find(r => r['Kit Number'] === '55520');
if (row55520) {
  const profile = transformRow(row55520, 'aaDNA');
  console.log('Sample 55520:');
  console.log('  kit_number:', profile.kit_number);
  console.log('  name:', profile.name);
  console.log('  haplogroup:', profile.haplogroup);
  console.log('  markers count:', Object.keys(profile.markers).length);
  console.log('  first 5 markers:', Object.keys(profile.markers).slice(0, 5).join(', '));
  console.log('\nJSON:', JSON.stringify(profile, null, 2));
} else {
  console.log('Sample 55520 NOT FOUND');
}

// Try to transform all rows and check how many have kit_number
const allProfiles = parseResult.data.map(row => transformRow(row, 'aaDNA'));
const validProfiles = allProfiles.filter(p => p.kit_number && p.kit_number.trim() !== '');
console.log('\n\nTotal rows:', parseResult.data.length);
console.log('Valid profiles with kit_number:', validProfiles.length);
console.log('Invalid profiles:', allProfiles.length - validProfiles.length);

// Check if 55520 is in valid profiles
const has55520 = validProfiles.some(p => p.kit_number === '55520');
console.log('55520 in valid profiles:', has55520);
