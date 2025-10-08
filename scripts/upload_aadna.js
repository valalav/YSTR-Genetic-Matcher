const fs = require('fs');
const { Pool } = require('pg');
const Papa = require('papaparse');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'ystr_matcher',
  user: 'postgres',
  password: 'secure_password'
});

async function upload() {
  console.log('Reading aadna.csv...');
  const csv = fs.readFileSync('downloads/aadna.csv', 'utf8');
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });

  console.log(`Parsed ${data.length} rows`);
  if (data.length > 0) {
    console.log('Sample row:', JSON.stringify(data[0], null, 2));
  }

  let uploaded = 0;
  let skipped = 0;

  for (const row of data) {
    const kitNumber = row['Kit Number'] || row['KitNumber'] || row['Kit'] || row['id'] || row['ID'];
    if (!kitNumber) {
      skipped++;
      continue;
    }

    // Extract markers
    const markers = {};
    for (const [key, value] of Object.entries(row)) {
      if (key.match(/DYS|CDY|YCAII|GATA/) && value && value !== '') {
        markers[key] = String(value);
      }
    }

    if (Object.keys(markers).length === 0) {
      skipped++;
      continue;
    }

    try {
      await pool.query(`
        INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (kit_number) DO UPDATE
        SET markers = EXCLUDED.markers,
            haplogroup = EXCLUDED.haplogroup
      `, [
        String(kitNumber),
        row['Name'] || row['name'] || '',
        row['Country'] || row['country'] || '',
        row['Haplogroup'] || row['haplogroup'] || '',
        JSON.stringify(markers)
      ]);
      uploaded++;
      if (uploaded % 100 === 0) {
        console.log(`Uploaded ${uploaded} profiles...`);
      }
    } catch (err) {
      console.error(`Error uploading ${kitNumber}:`, err.message);
      skipped++;
    }
  }

  console.log(`\nDone!`);
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Skipped: ${skipped}`);

  await pool.end();
}

upload().catch(console.error);
