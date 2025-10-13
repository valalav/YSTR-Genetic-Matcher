/**
 * Upload only AADNA CSV file to database
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Database connection
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'ystr_matcher',
  user: 'postgres',
  password: 'secure_ystr_password_2024'
};

/**
 * Parse CSV line handling quoted values
 */
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

/**
 * Parse CSV and convert to profiles format
 */
function parseCSVToProfiles(csvPath, sourceId) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`📊 Parsing ${csvPath}...`);

      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        console.log(`⚠️ No data in ${csvPath}`);
        resolve([]);
        return;
      }

      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const profiles = [];

      console.log(`Found ${headers.length} headers`);

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        if (values.length !== headers.length) {
          console.log(`⚠️ Skipping row ${i} in ${csvPath}: column mismatch (${values.length} vs ${headers.length})`);
          continue;
        }

        const profile = {};
        const markers = {};

        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const value = values[j].trim();

          // Identify profile fields vs markers
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes('kit') && lowerHeader.includes('number')) {
            profile.kitNumber = value;
          } else if (lowerHeader.includes('name') && !lowerHeader.includes('ancestor')) {
            profile.name = value;
          } else if (lowerHeader.includes('country')) {
            profile.country = value;
          } else if (lowerHeader.includes('haplogroup')) {
            profile.haplogroup = value;
          } else if (header.startsWith('DYS') || header.startsWith('Y-') || header === 'CDY' || header === 'YCAII') {
            // STR markers - only add if value exists and is not empty
            if (value && value !== '' && value !== '-' && value !== '0') {
              markers[header] = value;
            }
          }
        }

        // Only add profiles with kit number and at least one marker
        if (profile.kitNumber && Object.keys(markers).length > 0) {
          profile.markers = markers;
          profile.source = sourceId;
          profiles.push(profile);

          // Log first few profiles for debugging
          if (profiles.length <= 5) {
            console.log(`Profile ${profiles.length}:`, {
              kitNumber: profile.kitNumber,
              name: profile.name || 'N/A',
              country: profile.country || 'N/A',
              haplogroup: profile.haplogroup || 'N/A',
              markerCount: Object.keys(markers).length
            });
          }
        }
      }

      console.log(`✅ Parsed ${profiles.length} profiles from ${csvPath}`);
      resolve(profiles);

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Upload profiles to PostgreSQL database
 */
async function uploadToDatabase(profiles) {
  if (profiles.length === 0) {
    console.log('⚠️ No profiles to upload');
    return { inserted: 0, errors: 0 };
  }

  console.log(`📤 Uploading ${profiles.length} profiles to database...`);

  const client = new Client(dbConfig);
  await client.connect();

  let inserted = 0;
  let errors = 0;

  try {
    // Use individual inserts to avoid conflicts
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];

      try {
        const query = `
          INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (kit_number)
          DO UPDATE SET
            name = EXCLUDED.name,
            country = EXCLUDED.country,
            haplogroup = EXCLUDED.haplogroup,
            markers = EXCLUDED.markers,
            updated_at = CURRENT_TIMESTAMP
        `;

        await client.query(query, [
          profile.kitNumber,
          profile.name || '',
          profile.country || '',
          profile.haplogroup || '',
          JSON.stringify(profile.markers)
        ]);

        inserted++;

        // Log progress
        if (i % 100 === 0) {
          console.log(`📊 Uploaded ${inserted}/${profiles.length} profiles...`);
        }

        // Log specific profile 39666
        if (profile.kitNumber === '39666') {
          console.log(`🎯 Found and uploaded kit 39666:`, {
            name: profile.name,
            country: profile.country,
            haplogroup: profile.haplogroup,
            markerCount: Object.keys(profile.markers).length
          });
        }

      } catch (error) {
        console.error(`❌ Error uploading profile ${profile.kitNumber}:`, error.message);
        errors++;
      }
    }

  } finally {
    await client.end();
  }

  return { inserted, errors };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting AADNA upload...');

  try {
    const csvPath = path.join(__dirname, 'downloads', 'aadna.csv');

    if (!fs.existsSync(csvPath)) {
      console.log(`❌ File not found: ${csvPath}`);
      return;
    }

    // Parse CSV to profiles
    const profiles = await parseCSVToProfiles(csvPath, 'aadna');

    if (profiles.length > 0) {
      // Upload to database
      const result = await uploadToDatabase(profiles);
      console.log(`✅ AADNA upload complete: ${result.inserted} inserted, ${result.errors} errors`);

      // Check if 39666 is now in database
      const client = new Client(dbConfig);
      await client.connect();

      const checkResult = await client.query(
        'SELECT kit_number, name, country, haplogroup FROM ystr_profiles WHERE kit_number = $1',
        ['39666']
      );

      if (checkResult.rows.length > 0) {
        console.log('🎯 Kit 39666 found in database:', checkResult.rows[0]);
      } else {
        console.log('❌ Kit 39666 still not found in database');
      }

      await client.end();
    } else {
      console.log(`⚠️ No valid profiles found in AADNA`);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}