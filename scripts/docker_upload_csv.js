const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { execSync } = require('child_process');

async function uploadCSVViaDocker() {
  try {
    console.log('🚀 Uploading CSV files via Docker PostgreSQL...');

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

      // Process in batches to avoid memory issues
      const batchSize = 100;
      const sqlStatements = [];

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

          // Create SQL statement
          const escapedKitNumber = kitNumber.replace(/'/g, "''");
          const escapedName = (name || '').replace(/'/g, "''");
          const escapedCountry = (country || '').replace(/'/g, "''");
          const escapedHaplogroup = (haplogroup || '').replace(/'/g, "''");
          const escapedMarkers = JSON.stringify(markers).replace(/'/g, "''");

          const sqlStatement = `INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers) VALUES ('${escapedKitNumber}', '${escapedName}', '${escapedCountry}', '${escapedHaplogroup}', '${escapedMarkers}') ON CONFLICT (kit_number) DO NOTHING;`;
          sqlStatements.push(sqlStatement);

          uploadedCount++;

          // Execute batch
          if (sqlStatements.length >= batchSize) {
            const combinedSQL = sqlStatements.join('\n');
            const tempSQLFile = path.join(__dirname, `temp_batch_${uploadedCount}.sql`);
            fs.writeFileSync(tempSQLFile, combinedSQL, 'utf-8');

            try {
              execSync(`docker exec -i ystr-postgres psql -U postgres -d ystr_matcher -f /tmp/batch.sql`, {
                input: combinedSQL,
                encoding: 'utf-8'
              });
              console.log(`  ✅ Uploaded batch: ${uploadedCount} profiles...`);
            } catch (error) {
              console.error(`  ❌ Batch upload error:`, error.message);
            }

            fs.unlinkSync(tempSQLFile);
            sqlStatements.length = 0; // Clear array
          }

        } catch (error) {
          console.error(`  ❌ Error processing row ${i + 1}:`, error.message);
          skippedCount++;
        }
      }

      // Execute remaining statements
      if (sqlStatements.length > 0) {
        const combinedSQL = sqlStatements.join('\n');
        try {
          execSync(`docker exec -i ystr-postgres psql -U postgres -d ystr_matcher`, {
            input: combinedSQL,
            encoding: 'utf-8'
          });
          console.log(`  ✅ Uploaded final batch`);
        } catch (error) {
          console.error(`  ❌ Final batch upload error:`, error.message);
        }
      }

      console.log(`✅ ${fileName}: ${uploadedCount} uploaded, ${skippedCount} skipped`);
      totalProfiles += uploadedCount;
    }

    console.log(`\n🎉 Total upload completed: ${totalProfiles} profiles!`);

    // Check final count
    try {
      const countResult = execSync(`docker exec ystr-postgres psql -U postgres -d ystr_matcher -c "SELECT COUNT(*) as total FROM ystr_profiles;"`, {
        encoding: 'utf-8'
      });
      console.log(`📊 Database status:`, countResult);
    } catch (error) {
      console.error('Error checking final count:', error.message);
    }

  } catch (error) {
    console.error('❌ Upload failed:', error);
  }
}

uploadCSVViaDocker();