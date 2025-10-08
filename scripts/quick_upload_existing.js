const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'ystr_matcher',
  password: 'postgres',
  port: 5432,
});

async function uploadExistingFiles() {
  try {
    console.log('🚀 Uploading existing CSV files to PostgreSQL...');

    const downloadsDir = path.join(__dirname, 'downloads');
    const csvFiles = fs.readdirSync(downloadsDir).filter(file =>
      file.endsWith('.csv') && fs.statSync(path.join(downloadsDir, file)).size > 1000
    );

    console.log(`📁 Found ${csvFiles.length} CSV files to upload`);

    let totalProfiles = 0;

    for (const fileName of csvFiles) {
      const filePath = path.join(downloadsDir, fileName);
      const fileStats = fs.statSync(filePath);

      console.log(`\n📄 Processing ${fileName} (${(fileStats.size / 1024 / 1024).toFixed(1)}MB)...`);

      const csvContent = fs.readFileSync(filePath, 'utf-8');

      // Parse CSV
      const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim()
      });

      if (parseResult.errors.length > 0) {
        console.warn(`⚠️  Parse errors in ${fileName}:`, parseResult.errors.length);
      }

      console.log(`📊 Parsed ${parseResult.data.length} rows from ${fileName}`);

      let uploadedCount = 0;
      let skippedCount = 0;

      // Process each row
      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i];

        try {
          // Extract kit number
          let kitNumber = row['kitNumber'] || row['kit_number'] || row['Kit Number'] ||
                         row['Kit'] || row['KitNumber'] || row['ID'] || row['id'] ||
                         row['№'] || row['Номер'] || row['Sample'];

          if (!kitNumber) {
            skippedCount++;
            continue;
          }

          kitNumber = String(kitNumber).trim();

          // Extract basic info
          const name = row['name'] || row['Name'] || row['Имя'] || row['Sample Name'] || '';
          const country = row['country'] || row['Country'] || row['Страна'] || row['Origin'] || '';
          const haplogroup = row['haplogroup'] || row['Haplogroup'] || row['Гаплогруппа'] ||
                           row['Terminal SNP'] || row['Y-Haplogroup'] || '';

          // Extract STR markers
          const markers = {};
          const commonMarkers = [
            'DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385a', 'DYS385b', 'DYS426', 'DYS388',
            'DYS439', 'DYS389I', 'DYS392', 'DYS389II', 'DYS458', 'DYS459a', 'DYS459b', 'DYS455',
            'DYS454', 'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464a', 'DYS464b', 'DYS464c',
            'DYS464d', 'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607', 'DYS576', 'DYS570',
            'CDY', 'DYS442', 'DYS438', 'DYS531', 'DYS578', 'DYS389i', 'DYS389ii'
          ];

          // Find markers in row
          for (const marker of commonMarkers) {
            const value = row[marker] || row[marker.toLowerCase()];
            if (value && value !== '' && value !== '-' && value !== 'null') {
              markers[marker] = String(value).trim();
            }
          }

          // Also check for any DYS columns
          for (const [key, value] of Object.entries(row)) {
            if (key.match(/^DYS\d+/i) && value && value !== '' && value !== '-') {
              const markerName = key.toUpperCase();
              if (!markers[markerName]) {
                markers[markerName] = String(value).trim();
              }
            }
          }

          if (Object.keys(markers).length === 0) {
            skippedCount++;
            continue;
          }

          // Insert into database
          const insertQuery = `
            INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (kit_number) DO NOTHING
          `;

          await pool.query(insertQuery, [
            kitNumber,
            name || '',
            country || '',
            haplogroup || '',
            JSON.stringify(markers)
          ]);

          uploadedCount++;

          if (uploadedCount % 1000 === 0) {
            console.log(`  ✅ ${uploadedCount} profiles uploaded...`);
          }

        } catch (error) {
          console.error(`  ❌ Error processing row ${i + 1}:`, error.message);
          skippedCount++;
        }
      }

      console.log(`✅ ${fileName}: ${uploadedCount} uploaded, ${skippedCount} skipped`);
      totalProfiles += uploadedCount;
    }

    console.log(`\n🎉 Total upload completed: ${totalProfiles} profiles!`);

    // Check final count
    const countResult = await pool.query('SELECT COUNT(*) as total FROM ystr_profiles');
    console.log(`📊 Database now contains: ${countResult.rows[0].total} profiles`);

  } catch (error) {
    console.error('❌ Upload failed:', error);
  } finally {
    await pool.end();
  }
}

uploadExistingFiles();