/**
 * Script to download CSV data from Google Sheets and upload to PostgreSQL
 * Downloads all repositories from str-matcher config and loads into new v2 database
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Repository URLs from str-matcher config
const repositories = [
  {
    id: 'aadna',
    name: 'AADNA.ru Database',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTp8VNm5yS63RiflBpMY4b8d4RBTPecjU_RrC10EDcgSitcQxRtt1QbeN67g8bYOyqB088GLOTHIG5g/pub?gid=90746110&single=true&output=csv',
  },
  {
    id: 'G',
    name: 'G Database',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSOBSOYSNmI7X0vbDNa8qXCloT18ONgs1r9kht_gO62RcMqHuirFZWh-aAl45EOBr_2X-r285ZG4bnf/pub?gid=886727200&single=true&output=csv',
  },
  {
    id: 'r1a',
    name: 'R1a Database',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRU8tnVM0DyHCYmpdQhKAdyjiwc1Q0GYDb1EOBEZu_YPvmEvfQZPSZAsZo2Cvkk3R6qMElcTVKNjNYZ/pub?gid=1094141657&single=true&output=csv',
  },
  {
    id: 'J2',
    name: 'J2 Database',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQdOZKzZjPnAo2WsmK86PymoWNxGm2Dc1kEMGAbtw5kWHPDURgN9e5PRR3x9_ag-CdAntzcSJRddbOS/pub?gid=1964163364&single=true&output=csv',
  },
  {
    id: 'J1',
    name: 'J1 Database',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSf-FRmBHW8hnCopHADt54LApuvyuhpeImR-5xZPRHY_Ca91H8t_uPPgtrN0cIOZHzamN0zjwxV60cX/pub?gid=1814447974&single=true&output=csv',
  },
  {
    id: 'E',
    name: 'E Database',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTvc9oN1jumSux4OBv8MUEzCJyabastzp06C7tuEwv_Ud_DW60ISrVI1D-gKjWs6JibefG8D_pQfIyI/pub?gid=1307961167&single=true&output=csv',
  },
  {
    id: 'I',
    name: 'I Database',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRasrJA3vR1vJineI98GIvmNBL6UXxdpLbJ-k0Qb_60ukvGn9ZDkopG3FDKm0GJg8M8i7r5vK__qsI-/pub?gid=1455355483&single=true&output=csv',
  },
  {
    id: 'Others',
    name: 'Others Database',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSs84tXzDaQzQHjfG4TlR7ARTaE_iU12cgKzjxg7GaQPHRkbisVHRJ8ywx7ldkKV4hyI5pBwYVlYwLz/pub?gid=65836825&single=true&output=csv',
  },
  {
    id: 'Genopoisk',
    name: 'Genopoisk',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQvpu_8LnaCLirvcL1U_HmQZ2dV-sGVtcQ05tI2fmO3Sym-BJ_LE5i9cirzS42vgmWKt21qicEUVRJ2/pub?gid=0&single=true&output=csv',
  }
];

// Database connection
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'ystr_matcher',
  user: 'postgres',
  password: 'secure_ystr_password_2024'
};

// Create downloads directory
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

/**
 * Download a CSV file from URL, handling redirects
 */
function downloadCSV(url, filename) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading ${filename}...`);

    const file = fs.createWriteStream(path.join(downloadsDir, filename));

    function makeRequest(requestUrl) {
      https.get(requestUrl, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
          console.log(`🔄 Redirect ${response.statusCode} for ${filename}, following to: ${response.headers.location}`);
          file.destroy(); // Clean up the current stream
          return makeRequest(response.headers.location);
        }

        if (response.statusCode === 200) {
          response.pipe(file);

          file.on('finish', () => {
            file.close();
            const stats = fs.statSync(path.join(downloadsDir, filename));
            console.log(`✅ Downloaded ${filename} (${Math.round(stats.size / 1024)}KB)`);
            resolve(path.join(downloadsDir, filename));
          });
        } else {
          file.destroy();
          reject(new Error(`Failed to download ${filename}: ${response.statusCode}`));
        }
      }).on('error', (err) => {
        file.destroy();
        reject(err);
      });
    }

    makeRequest(url);
  });
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

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        if (values.length !== headers.length) {
          console.log(`⚠️ Skipping row ${i} in ${csvPath}: column mismatch`);
          continue;
        }

        const profile = {};
        const markers = {};

        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const value = values[j].trim();

          // Identify profile fields vs markers
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes('kit') || lowerHeader === 'id' || lowerHeader === 'number') {
            profile.kitNumber = value;
          } else if (lowerHeader.includes('name') || lowerHeader === 'name') {
            profile.name = value;
          } else if (lowerHeader.includes('country') || lowerHeader.includes('страна')) {
            profile.country = value;
          } else if (lowerHeader.includes('haplo') || lowerHeader.includes('гаплогруппа')) {
            profile.haplogroup = value;
          } else if (value && value !== '' && value !== '-' && !isNaN(parseFloat(value))) {
            // Likely a marker
            markers[header] = value;
          }
        }

        // Only add profiles with kit number and at least one marker
        if (profile.kitNumber && Object.keys(markers).length > 0) {
          profile.markers = markers;
          profile.source = sourceId;
          profiles.push(profile);
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
    // Use batch insert for better performance
    const batchSize = 100;

    for (let i = 0; i < profiles.length; i += batchSize) {
      const batch = profiles.slice(i, i + batchSize);

      try {
        // Prepare batch insert
        const values = [];
        const placeholders = [];

        batch.forEach((profile, idx) => {
          const baseIdx = idx * 5;
          placeholders.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5})`);

          values.push(
            profile.kitNumber,
            profile.name || '',
            profile.country || '',
            profile.haplogroup || '',
            JSON.stringify(profile.markers)
          );
        });

        const query = `
          INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (kit_number)
          DO UPDATE SET
            name = EXCLUDED.name,
            country = EXCLUDED.country,
            haplogroup = EXCLUDED.haplogroup,
            markers = EXCLUDED.markers,
            updated_at = CURRENT_TIMESTAMP
        `;

        await client.query(query, values);
        inserted += batch.length;

        // Progress indicator
        if (i % 1000 === 0) {
          console.log(`📊 Uploaded ${inserted}/${profiles.length} profiles...`);
        }

      } catch (error) {
        console.error(`❌ Error uploading batch ${i}-${i + batchSize}:`, error.message);
        errors += batch.length;
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
  console.log('🚀 Starting CSV download and database upload process...');
  console.log(`📊 Processing ${repositories.length} repositories`);

  let totalProfiles = 0;
  let totalInserted = 0;
  let totalErrors = 0;

  try {
    for (const repo of repositories) {
      console.log(`\n🔄 Processing ${repo.name}...`);

      try {
        // Download CSV
        const filename = `${repo.id}.csv`;
        const csvPath = await downloadCSV(repo.url, filename);

        // Parse CSV to profiles
        const profiles = await parseCSVToProfiles(csvPath, repo.id);
        totalProfiles += profiles.length;

        if (profiles.length > 0) {
          // Upload to database
          const result = await uploadToDatabase(profiles);
          totalInserted += result.inserted;
          totalErrors += result.errors;

          console.log(`✅ ${repo.name}: ${result.inserted} inserted, ${result.errors} errors`);
        } else {
          console.log(`⚠️ ${repo.name}: No valid profiles found`);
        }

        // Clean up downloaded file to save space
        fs.unlinkSync(csvPath);

      } catch (error) {
        console.error(`❌ Error processing ${repo.name}:`, error.message);
      }
    }

    console.log('\n🎉 Upload complete!');
    console.log(`📊 Summary:`);
    console.log(`  • Total profiles processed: ${totalProfiles}`);
    console.log(`  • Successfully inserted: ${totalInserted}`);
    console.log(`  • Errors: ${totalErrors}`);

    // Get final database stats
    const client = new Client(dbConfig);
    await client.connect();

    const result = await client.query('SELECT COUNT(*) as count FROM ystr_profiles');
    const totalInDB = result.rows[0].count;

    await client.end();

    console.log(`  • Total profiles in database: ${totalInDB}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, downloadCSV, parseCSVToProfiles, uploadToDatabase };