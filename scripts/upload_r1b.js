const XLSX = require('xlsx');
const { Pool } = require('pg');
const path = require('path');

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'ystr_matcher',
  password: 'postgres',
  port: 5432,
});

async function uploadR1bData() {
  try {
    console.log('📊 Starting R1b Excel data upload...');

    // Read Excel file
    const excelPath = path.join(__dirname, '..', 'R1b.xlsx');
    console.log(`📁 Reading Excel file: ${excelPath}`);

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log(`📋 Found ${data.length} rows in Excel file`);

    if (data.length === 0) {
      console.log('❌ No data found in Excel file');
      return;
    }

    // Print first row to understand structure
    console.log('🔍 First row structure:');
    console.log(JSON.stringify(data[0], null, 2));

    let uploadedCount = 0;
    let skippedCount = 0;

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      try {
        // Extract kit number - try different possible column names
        let kitNumber = row['Kit Number'] || row['KitNumber'] || row['Kit'] ||
                       row['kit_number'] || row['kit'] || row['ID'] || row['id'];

        if (!kitNumber) {
          console.log(`⚠️  Row ${i + 1}: No kit number found, skipping`);
          skippedCount++;
          continue;
        }

        // Convert to string and clean
        kitNumber = String(kitNumber).trim();

        // Extract other fields with flexible column name matching
        const name = row['Name'] || row['name'] || row['Sample Name'] ||
                    row['sample_name'] || row['Individual'] || '';

        const country = row['Country'] || row['country'] || row['Origin'] ||
                       row['origin'] || row['Population'] || row['population'] || '';

        const haplogroup = row['Haplogroup'] || row['haplogroup'] || row['Haplotype'] ||
                          row['haplotype'] || row['Y-Haplogroup'] || row['Terminal SNP'] ||
                          row['terminal_snp'] || 'R1b';

        // Extract STR markers - look for common STR marker names
        const markers = {};
        const strMarkers = [
          'DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385a', 'DYS385b', 'DYS426', 'DYS388',
          'DYS439', 'DYS389I', 'DYS392', 'DYS389II', 'DYS458', 'DYS459a', 'DYS459b', 'DYS455',
          'DYS454', 'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464a', 'DYS464b', 'DYS464c',
          'DYS464d', 'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607', 'DYS576', 'DYS570',
          'CDY', 'DYS442', 'DYS438', 'DYS531', 'DYS578'
        ];

        // Try to find markers in the row
        for (const marker of strMarkers) {
          const value = row[marker];
          if (value !== undefined && value !== null && value !== '') {
            markers[marker] = String(value).trim();
          }
        }

        // Also check for any column that looks like a marker (DYS followed by numbers)
        for (const [key, value] of Object.entries(row)) {
          if (key.match(/^DYS\d+/i) && value !== undefined && value !== null && value !== '') {
            const markerName = key.toUpperCase();
            if (!markers[markerName]) {
              markers[markerName] = String(value).trim();
            }
          }
        }

        if (Object.keys(markers).length === 0) {
          console.log(`⚠️  Row ${i + 1}: No STR markers found, skipping kit ${kitNumber}`);
          skippedCount++;
          continue;
        }

        // Insert into database
        const insertQuery = `
          INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers, source)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (kit_number)
          DO UPDATE SET
            name = EXCLUDED.name,
            country = EXCLUDED.country,
            haplogroup = EXCLUDED.haplogroup,
            markers = EXCLUDED.markers,
            source = EXCLUDED.source,
            updated_at = CURRENT_TIMESTAMP
        `;

        await pool.query(insertQuery, [
          kitNumber,
          name || '',
          country || '',
          haplogroup || 'R1b',
          JSON.stringify(markers),
          'R1b'
        ]);

        uploadedCount++;

        if (uploadedCount % 100 === 0) {
          console.log(`✅ Uploaded ${uploadedCount} profiles...`);
        }

      } catch (error) {
        console.error(`❌ Error processing row ${i + 1}:`, error.message);
        skippedCount++;
      }
    }

    console.log(`\n🎉 R1b upload completed!`);
    console.log(`✅ Successfully uploaded: ${uploadedCount} profiles`);
    console.log(`⚠️  Skipped: ${skippedCount} profiles`);

    // Show database stats
    const statsQuery = `
      SELECT
        source,
        COUNT(*) as count,
        AVG(jsonb_array_length(jsonb_object_keys(markers))) as avg_markers
      FROM ystr_profiles
      WHERE source = 'R1b'
      GROUP BY source
    `;

    const stats = await pool.query(statsQuery);
    console.log('\n📊 Database stats for R1b:');
    console.table(stats.rows);

  } catch (error) {
    console.error('❌ Upload failed:', error);
  } finally {
    await pool.end();
  }
}

// Check if XLSX module is available
try {
  require.resolve('xlsx');
  uploadR1bData();
} catch (e) {
  console.log('📦 Installing xlsx module...');
  const { execSync } = require('child_process');
  execSync('npm install xlsx', { stdio: 'inherit' });
  console.log('✅ xlsx module installed, starting upload...');
  uploadR1bData();
}