const fs = require('fs');
const { Pool } = require('pg');
const Papa = require('papaparse');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'ystr_matcher',
  user: 'postgres',
  password: 'secure_password',
  max: 10
});

async function uploadDB() {
  console.log('Starting DB.csv upload...');
  console.time('Total Upload Time');

  const csv = fs.readFileSync('c:/_Data/DNA/Projects/DB/NewDB/DB.csv', 'utf8');

  console.log('Parsing CSV...');
  const { data } = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    delimiter: ';'  // Important: semicolon delimiter
  });

  console.log(`Parsed ${data.length} rows`);

  if (data.length > 0) {
    console.log('Sample columns:', Object.keys(data[0]).slice(0, 10));
  }

  let uploaded = 0;
  let skipped = 0;
  const batchSize = 500;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, Math.min(i + batchSize, data.length));

    for (const row of batch) {
      const kitNumber = row['Kit Number'] || row['KitNumber'] || row['Kit'];
      if (!kitNumber || kitNumber === '') {
        skipped++;
        continue;
      }

      // Extract markers
      const markers = {};
      for (const [key, value] of Object.entries(row)) {
        if (key.match(/^(DYS|CDY|YCAII|Y-GATA|DYF|Y-GGAAT)/i) && value && value !== '') {
          markers[key] = String(value).trim();
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
        `, [
          String(kitNumber).trim(),
          (row['Name'] || '').trim(),
          (row['Country'] || '').trim(),
          (row['Haplogroup'] || '').trim(),
          JSON.stringify(markers)
        ]);

        uploaded++;

        if (uploaded % 1000 === 0) {
          console.log(`Uploaded ${uploaded} profiles... (skipped: ${skipped})`);
        }
      } catch (err) {
        if (err.code === '23505') {
          // Duplicate key - skip
          skipped++;
        } else {
          console.error(`Error uploading ${kitNumber}:`, err.message);
          skipped++;
        }
      }
    }
  }

  console.log('\n=== Upload Complete ===');
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Skipped: ${skipped}`);
  console.timeEnd('Total Upload Time');

  await pool.end();
}

uploadDB().catch(console.error);
