#!/usr/bin/env node

/**
 * CSV Import Script for PostgreSQL YSTR Database
 *
 * Imports Y-DNA STR profiles from CSV files into PostgreSQL database
 *
 * Usage:
 *   node backend/scripts/import-csv-to-postgres.js --file=path/to/file.csv --haplogroup=R1a
 *   node backend/scripts/import-csv-to-postgres.js --file=scripts/downloads/G.csv --haplogroup=G --batch-size=5000
 *
 * Options:
 *   --file <path>        Path to CSV file (required)
 *   --haplogroup <name>  Haplogroup name (required)
 *   --batch-size <n>     Number of profiles per batch (default: 5000)
 *   --skip-validation    Skip profile validation
 *   --dry-run            Parse CSV but don't import to database
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { pool, executeQuery } = require('../config/database');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: null,
    haplogroup: null,
    batchSize: 5000,
    skipValidation: false,
    dryRun: false
  };

  args.forEach(arg => {
    if (arg.startsWith('--file=')) {
      options.file = arg.split('=')[1];
    } else if (arg.startsWith('--haplogroup=')) {
      options.haplogroup = arg.split('=')[1];
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1]);
    } else if (arg === '--skip-validation') {
      options.skipValidation = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  });

  // Validate required options
  if (!options.file) {
    console.error('❌ Error: --file option is required');
    process.exit(1);
  }

  if (!options.haplogroup) {
    console.error('❌ Error: --haplogroup option is required');
    process.exit(1);
  }

  if (!fs.existsSync(options.file)) {
    console.error(`❌ Error: File not found: ${options.file}`);
    process.exit(1);
  }

  return options;
}

// Extract STR markers from CSV row
function extractMarkers(row) {
  const markers = {};
  const excludeKeys = [
    'kitnumber', 'kit_number', 'kit number', 'kitno', '-', '№',
    'name', 'fullname', 'full_name', 'full name', 'paternal ancestor name',
    'country', 'location', 'lacation',
    'haplogroup', 'haplo', 'clade', 'ftdna hg', 'yfull', 'ftdna tree link', 'yfull_tree',
    'source', 'project', 'database', 'lab', 'mtdna',
    'фамилия', 'широта', 'долгота', 'субэтнос', 'гг1', 'гг2', 'гг3', 'гг4', 'гг5'
  ];

  Object.keys(row).forEach(key => {
    const lowerKey = key.toLowerCase().trim();

    // Skip excluded keys and empty values
    if (excludeKeys.includes(lowerKey)) {
      return;
    }

    // Skip non-STR markers (only allow DYS*, DYF*, Y-*, CDY*, YCAII)
    const upperKey = key.toUpperCase();
    if (!upperKey.startsWith('DYS') &&
        !upperKey.startsWith('DYF') &&
        !upperKey.startsWith('Y-') &&
        !upperKey.startsWith('CDY') &&
        upperKey !== 'YCAII') {
      return;
    }

    const value = row[key]?.toString().trim();
    if (value && value !== '' && value !== '0' && value !== '-') {
      markers[key] = value;
    }
  });

  return markers;
}

// Transform CSV row to profile object
function transformRow(row, defaultHaplogroup) {
  const profile = {
    kitNumber: row.kitNumber || row.kit_number || row.KitNumber || row['Kit Number'] || row.kitno || row.KitNo || row['-'],
    name: row.name || row.Name || row.fullname || row.FullName || row.full_name || row['Full Name'] || '',
    country: row.country || row.Country || row.location || row.Location || row.Lacation || '',
    haplogroup: row.haplogroup || row.Haplogroup || row.Haplo || row.clade || row.Clade || row['FTDNA HG'] || row.Yfull || defaultHaplogroup || '',
    markers: extractMarkers(row)
  };

  return profile;
}

// Validate profile object
function validateProfile(profile, options) {
  if (!options.skipValidation) {
    // Must have kit number
    if (!profile.kitNumber || profile.kitNumber.trim() === '') {
      return { valid: false, reason: 'Missing kit number' };
    }

    // Must have at least one marker
    if (Object.keys(profile.markers).length === 0) {
      return { valid: false, reason: 'No markers found' };
    }

    // Kit number should be reasonable length
    if (profile.kitNumber.length > 50) {
      return { valid: false, reason: 'Kit number too long' };
    }
  }

  return { valid: true };
}

// Calculate file size in MB
function getFileSizeMB(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / (1024 * 1024)).toFixed(2);
}

// Main import function
async function importCSV(options) {
  console.log('🚀 Starting CSV Import');
  console.log('📄 File:', options.file);
  console.log('🧬 Haplogroup:', options.haplogroup);
  console.log('📦 Batch Size:', options.batchSize);
  console.log('---');

  const startTime = Date.now();
  const fileSizeMB = getFileSizeMB(options.file);

  // Read CSV file
  console.log(`📖 Reading CSV file (${fileSizeMB} MB)...`);
  const csvContent = fs.readFileSync(options.file, 'utf-8');

  // Parse CSV
  console.log('🔍 Parsing CSV...');
  const parseResult = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim()
  });

  if (parseResult.errors.length > 0) {
    console.error('❌ CSV Parsing Errors:');
    parseResult.errors.slice(0, 5).forEach(err => {
      console.error(`  Line ${err.row}: ${err.message}`);
    });
    if (parseResult.errors.length > 5) {
      console.error(`  ... and ${parseResult.errors.length - 5} more errors`);
    }
  }

  console.log(`✅ Parsed ${parseResult.data.length} rows`);

  // Transform and validate profiles
  console.log('🔄 Transforming data...');
  const allProfiles = [];
  const invalidProfiles = [];

  parseResult.data.forEach((row, index) => {
    const profile = transformRow(row, options.haplogroup);
    const validation = validateProfile(profile, options);

    if (validation.valid) {
      allProfiles.push(profile);
    } else {
      invalidProfiles.push({ row: index + 2, reason: validation.reason, profile });
    }
  });

  console.log(`✅ Valid profiles: ${allProfiles.length}`);
  if (invalidProfiles.length > 0) {
    console.warn(`⚠️  Invalid profiles: ${invalidProfiles.length}`);
    if (!options.skipValidation) {
      invalidProfiles.slice(0, 3).forEach(inv => {
        console.warn(`  Row ${inv.row}: ${inv.reason}`);
      });
    }
  }

  // Remove duplicates by kit_number (keep last occurrence)
  console.log('🔍 Removing duplicates...');
  const uniqueProfiles = {};
  allProfiles.forEach(profile => {
    uniqueProfiles[profile.kitNumber] = profile;
  });
  const profiles = Object.values(uniqueProfiles);

  const duplicatesRemoved = allProfiles.length - profiles.length;
  if (duplicatesRemoved > 0) {
    console.warn(`⚠️  Removed ${duplicatesRemoved} duplicate kit numbers`);
  }

  console.log(`📊 Final profile count: ${profiles.length}`);

  // Calculate average markers
  const avgMarkers = profiles.length > 0
    ? (profiles.reduce((sum, p) => sum + Object.keys(p.markers).length, 0) / profiles.length).toFixed(2)
    : 0;
  console.log(`📈 Average markers per profile: ${avgMarkers}`);

  if (options.dryRun) {
    console.log('---');
    console.log('🏁 Dry run completed (no data imported)');
    console.log(`⏱️  Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    process.exit(0);
  }

  // Database import
  console.log('---');
  console.log('💾 Starting database import...');

  try {
    // Update or create haplogroup_databases entry
    console.log(`📝 Updating haplogroup_databases metadata...`);
    await executeQuery(`
      INSERT INTO haplogroup_databases (haplogroup, total_profiles, status, source_file, file_size_mb, avg_markers)
      VALUES ($1, $2, 'loading', $3, $4, $5)
      ON CONFLICT (haplogroup)
      DO UPDATE SET
        total_profiles = EXCLUDED.total_profiles,
        status = 'loading',
        source_file = EXCLUDED.source_file,
        file_size_mb = EXCLUDED.file_size_mb,
        avg_markers = EXCLUDED.avg_markers,
        updated_at = CURRENT_TIMESTAMP
    `, [options.haplogroup, profiles.length, path.basename(options.file), parseFloat(fileSizeMB), parseFloat(avgMarkers)]);

    // Bulk insert in batches
    let inserted = 0;
    const batchSize = options.batchSize;

    for (let i = 0; i < profiles.length; i += batchSize) {
      const batch = profiles.slice(i, i + batchSize);
      const progress = Math.min(i + batchSize, profiles.length);
      const percent = ((progress / profiles.length) * 100).toFixed(1);

      process.stdout.write(`\r📥 Importing... ${progress}/${profiles.length} (${percent}%)`);

      // Filter out any profiles with empty kit numbers (safety check)
      const validBatch = batch.filter(p => p.kitNumber && p.kitNumber.trim() !== '');

      if (validBatch.length === 0) {
        console.log(`\n⚠️  Skipped empty batch at position ${i}`);
        continue;
      }

      // Debug: log first profile in first batch
      if (i === 0 && validBatch.length > 0) {
        console.log(`\n🔍 First profile to insert:`, JSON.stringify(validBatch[0], null, 2).substring(0, 200));
      }

      // Convert camelCase keys to snake_case for SQL
      const sqlBatch = validBatch.map(profile => ({
        kit_number: profile.kitNumber,
        name: profile.name,
        country: profile.country,
        haplogroup: profile.haplogroup,
        markers: profile.markers
      }));

      const result = await executeQuery(
        'SELECT bulk_insert_profiles($1)',
        [JSON.stringify(sqlBatch)]
      );

      const batchInserted = result.rows[0].bulk_insert_profiles;
      inserted += batchInserted;

      // Debug: log if batch returned 0
      if (batchInserted === 0) {
        console.log(`\n⚠️  Batch at ${i} returned 0 inserts (${validBatch.length} profiles in batch)`);
      }
    }

    console.log(''); // New line after progress

    // Update status to active
    await executeQuery(`
      UPDATE haplogroup_databases
      SET status = 'active', total_profiles = $2
      WHERE haplogroup = $1
    `, [options.haplogroup, inserted]);

    // Refresh materialized view
    console.log('🔄 Refreshing statistics...');
    try {
      await executeQuery('REFRESH MATERIALIZED VIEW CONCURRENTLY marker_statistics');
    } catch (err) {
      // Fallback to non-concurrent refresh if concurrent fails
      console.log('⚠️  Concurrent refresh failed, using regular refresh...');
      await executeQuery('REFRESH MATERIALIZED VIEW marker_statistics');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('---');
    console.log('✅ Import completed successfully!');
    console.log(`📊 Imported: ${inserted} profiles`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`⚡ Speed: ${(inserted / parseFloat(duration)).toFixed(0)} profiles/second`);

  } catch (error) {
    console.error('---');
    console.error('❌ Import failed:', error.message);

    // Mark as error in database
    try {
      await executeQuery(`
        UPDATE haplogroup_databases
        SET status = 'error', description = $2
        WHERE haplogroup = $1
      `, [options.haplogroup, error.message]);
    } catch (updateError) {
      console.error('Failed to update error status:', updateError.message);
    }

    process.exit(1);
  }
}

// Main execution
(async () => {
  const options = parseArgs();

  try {
    await importCSV(options);
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    await pool.end();
    process.exit(1);
  }
})();
