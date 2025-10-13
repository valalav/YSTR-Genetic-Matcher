const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { execSync } = require('child_process');

async function uploadData() {
  try {
    console.log('Processing CSV files for upload...');

    const downloadsDir = path.join(__dirname, 'downloads');
    const csvFiles = fs.readdirSync(downloadsDir).filter(file =>
      file.endsWith('.csv') && fs.statSync(path.join(downloadsDir, file)).size > 1000
    );

    console.log(`Found ${csvFiles.length} CSV files to process`);

    let totalProfiles = 0;
    const allSqlStatements = [];

    // Common STR markers
    const commonMarkers = [
      'DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385a', 'DYS385b', 'DYS426', 'DYS388',
      'DYS439', 'DYS389I', 'DYS392', 'DYS389II', 'DYS458', 'DYS459a', 'DYS459b', 'DYS455',
      'DYS454', 'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464a', 'DYS464b', 'DYS464c',
      'DYS464d', 'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607', 'DYS576', 'DYS570',
      'CDY', 'DYS442', 'DYS438', 'DYS531', 'DYS578', 'DYS389i', 'DYS389ii'
    ];

    for (const fileName of csvFiles) {
      const filePath = path.join(downloadsDir, fileName);
      const fileStats = fs.statSync(filePath);

      console.log(`\nProcessing ${fileName} (${(fileStats.size / 1024 / 1024).toFixed(1)}MB)...`);

      const csvContent = fs.readFileSync(filePath, 'utf-8');

      // Parse CSV
      const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim()
      });

      if (parseResult.errors.length > 0) {
        console.warn(`Parse errors in ${fileName}:`, parseResult.errors.length);
      }

      console.log(`Parsed ${parseResult.data.length} rows from ${fileName}`);

      let uploadedCount = 0;
      let skippedCount = 0;

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

          // Create SQL statement with proper escaping
          const escapedKitNumber = kitNumber.replace(/'/g, "''");
          const escapedName = (name || '').replace(/'/g, "''");
          const escapedCountry = (country || '').replace(/'/g, "''");
          const escapedHaplogroup = (haplogroup || '').replace(/'/g, "''");
          const escapedMarkers = JSON.stringify(markers).replace(/'/g, "''");

          const sqlStatement = `INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers) VALUES ('${escapedKitNumber}', '${escapedName}', '${escapedCountry}', '${escapedHaplogroup}', '${escapedMarkers}') ON CONFLICT (kit_number) DO NOTHING;`;

          allSqlStatements.push(sqlStatement);
          uploadedCount++;

          if (uploadedCount % 1000 === 0) {
            console.log(`  Processed ${uploadedCount} profiles...`);
          }

        } catch (error) {
          console.error(`  Error processing row ${i + 1}:`, error.message);
          skippedCount++;
        }
      }

      console.log(`${fileName}: ${uploadedCount} processed, ${skippedCount} skipped`);
      totalProfiles += uploadedCount;
    }

    console.log(`\nTotal profiles processed: ${totalProfiles}`);

    // Write SQL to file
    const sqlFile = path.join(__dirname, 'upload_data.sql');
    console.log(`Writing SQL statements to ${sqlFile}...`);

    fs.writeFileSync(sqlFile, allSqlStatements.join('\n'), 'utf-8');

    console.log(`SQL file created with ${allSqlStatements.length} statements`);

    // Execute via Docker
    console.log('Executing SQL via Docker...');
    try {
      const result = execSync(`type "${sqlFile}" | docker exec -i ystr-postgres psql -U postgres -d ystr_matcher`, {
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 100 // 100MB buffer
      });

      console.log('SQL executed successfully!');
      console.log('Result:', result);

    } catch (error) {
      console.error('SQL execution failed:', error.message);
      return false;
    }

    // Check final count
    try {
      const countResult = execSync(`docker exec ystr-postgres psql -U postgres -d ystr_matcher -c "SELECT COUNT(*) as total FROM ystr_profiles;"`, {
        encoding: 'utf-8'
      });
      console.log('Final database count:', countResult);
    } catch (error) {
      console.error('Count check failed:', error.message);
    }

    return true;

  } catch (error) {
    console.error('Upload failed:', error);
    return false;
  }
}

uploadData();