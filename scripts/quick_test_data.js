const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'ystr_matcher',
  password: 'postgres',
  port: 5432,
});

async function insertTestData() {
  try {
    console.log('🔧 Inserting test data...');

    // Test profiles including kit 39666 from AADNA
    const testProfiles = [
      {
        kitNumber: '39666',
        name: 'Unknown',
        country: 'Circassia',
        haplogroup: 'C-F10085',
        markers: {
          'DYS393': '13',
          'DYS390': '24',
          'DYS19': '14',
          'DYS391': '11',
          'DYS385a': '11',
          'DYS385b': '14',
          'DYS426': '12',
          'DYS388': '12',
          'DYS439': '12',
          'DYS389I': '13',
          'DYS392': '13',
          'DYS389II': '29',
          'DYS458': '17',
          'DYS459a': '9',
          'DYS459b': '10',
          'DYS455': '11',
          'DYS454': '11',
          'DYS447': '24',
          'DYS437': '15',
          'DYS448': '19',
          'DYS449': '29'
        },
        source: 'AADNA'
      },
      {
        kitNumber: '100001',
        name: 'Test Profile 1',
        country: 'Russia',
        haplogroup: 'R1a-M198',
        markers: {
          'DYS393': '13',
          'DYS390': '25',
          'DYS19': '14',
          'DYS391': '11',
          'DYS385a': '11',
          'DYS385b': '14',
          'DYS426': '12',
          'DYS388': '12',
          'DYS439': '12',
          'DYS389I': '13',
          'DYS392': '13',
          'DYS389II': '29',
          'DYS458': '17',
          'DYS459a': '9',
          'DYS459b': '10'
        },
        source: 'TEST'
      },
      {
        kitNumber: '100002',
        name: 'Test Profile 2',
        country: 'Poland',
        haplogroup: 'R1a-M198',
        markers: {
          'DYS393': '13',
          'DYS390': '24',
          'DYS19': '14',
          'DYS391': '10',
          'DYS385a': '11',
          'DYS385b': '14',
          'DYS426': '12',
          'DYS388': '12',
          'DYS439': '12',
          'DYS389I': '13',
          'DYS392': '13',
          'DYS389II': '29',
          'DYS458': '17',
          'DYS459a': '9',
          'DYS459b': '10'
        },
        source: 'TEST'
      },
      {
        kitNumber: '100003',
        name: 'Test Profile 3',
        country: 'Germany',
        haplogroup: 'R1b-M269',
        markers: {
          'DYS393': '13',
          'DYS390': '24',
          'DYS19': '14',
          'DYS391': '11',
          'DYS385a': '11',
          'DYS385b': '14',
          'DYS426': '12',
          'DYS388': '12',
          'DYS439': '12',
          'DYS389I': '13',
          'DYS392': '13',
          'DYS389II': '29',
          'DYS458': '17',
          'DYS459a': '9',
          'DYS459b': '10'
        },
        source: 'TEST'
      },
      {
        kitNumber: '100004',
        name: 'Test Profile 4',
        country: 'Ukraine',
        haplogroup: 'I2a-M423',
        markers: {
          'DYS393': '12',
          'DYS390': '23',
          'DYS19': '15',
          'DYS391': '10',
          'DYS385a': '13',
          'DYS385b': '18',
          'DYS426': '11',
          'DYS388': '14',
          'DYS439': '11',
          'DYS389I': '12',
          'DYS392': '14',
          'DYS389II': '28',
          'DYS458': '16',
          'DYS459a': '8',
          'DYS459b': '9'
        },
        source: 'TEST'
      }
    ];

    for (const profile of testProfiles) {
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
        profile.kitNumber,
        profile.name,
        profile.country,
        profile.haplogroup,
        JSON.stringify(profile.markers),
        profile.source
      ]);

      console.log(`✅ Inserted profile ${profile.kitNumber}`);
    }

    // Check results
    const countQuery = 'SELECT COUNT(*) as total FROM ystr_profiles';
    const result = await pool.query(countQuery);
    console.log(`\n📊 Total profiles in database: ${result.rows[0].total}`);

    // Test search for kit 39666
    const searchQuery = 'SELECT kit_number, name, country, haplogroup FROM ystr_profiles WHERE kit_number = $1';
    const searchResult = await pool.query(searchQuery, ['39666']);

    if (searchResult.rows.length > 0) {
      console.log(`✅ Kit 39666 found: ${JSON.stringify(searchResult.rows[0])}`);
    } else {
      console.log('❌ Kit 39666 not found');
    }

    console.log('\n🎉 Test data inserted successfully!');

  } catch (error) {
    console.error('❌ Error inserting test data:', error);
  } finally {
    await pool.end();
  }
}

insertTestData();