const XLSX = require('xlsx');
const { Pool } = require('pg');
const path = require('path');

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'ystr_matcher',
  password: 'secure_password',
  port: 5432,
  max: 20,
});

async function uploadDB() {
  try {
    console.log('Starting full DB upload...');
    console.log('Reading Excel file...');

    // Read Excel file
    const excelPath = path.join(__dirname, '..', 'DB.xlsx');
    const workbook = XLSX.readFile(excelPath, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log(`Found ${data.length} rows in Excel file`);

    if (data.length === 0) {
      console.log('No data found in Excel file');
      return;
    }

    // Print first row to understand structure
    console.log('First row structure:');
    console.log(JSON.stringify(data[0], null, 2));

    let uploadedCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;

    // Batch processing
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, Math.min(i + batchSize, data.length));

      for (const row of batch) {
        try {
          // Extract kit number - try different possible column names
          let kitNumber = row['Kit Number'] || row['KitNumber'] || row['Kit'] ||
                         row['kit_number'] || row['kit'] || row['ID'] || row['id'];

          if (!kitNumber) {
            skippedCount++;
            continue;
          }

          // Extract metadata
          const name = row['Name'] || row['name'] || '';
          const country = row['Country'] || row['country'] || '';
          const haplogroup = row['Haplogroup'] || row['haplogroup'] || '';

          // Extract all STR markers (DYS*, CDY, YCAII, GATA-H4)
          const markers = {};
          for (const [key, value] of Object.entries(row)) {
            // Check if this is a marker column
            if (key.match(/^(DYS|CDY|YCAII|Y-GATA)/i) && value !== null && value !== undefined && value !== '') {
              markers[key] = String(value);
            }
          }

          // Skip if no markers
          if (Object.keys(markers).length === 0) {
            skippedCount++;
            continue;
          }

          // Insert into database with ON CONFLICT to handle duplicates
          const result = await pool.query(`
            INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (kit_number) DO UPDATE
            SET markers = EXCLUDED.markers,
                haplogroup = EXCLUDED.haplogroup,
                name = EXCLUDED.name,
                country = EXCLUDED.country
            RETURNING (xmax = 0) AS inserted
          `, [
            String(kitNumber),
            name,
            country,
            haplogroup,
            JSON.stringify(markers)
          ]);

          if (result.rows[0].inserted) {
            uploadedCount++;
          } else {
            duplicateCount++;
          }

          if ((uploadedCount + duplicateCount) % 1000 === 0) {
            console.log(`Progress: ${uploadedCount} uploaded, ${duplicateCount} updated, ${skippedCount} skipped`);
          }

        } catch (err) {
          console.error(`Error processing row:`, err.message);
          skippedCount++;
        }
      }
    }

    console.log('\n=== Upload Complete ===');
    console.log(`Uploaded (new): ${uploadedCount}`);
    console.log(`Updated (duplicates): ${duplicateCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Total processed: ${uploadedCount + duplicateCount + skippedCount}`);

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await pool.end();
  }
}

uploadDB();
