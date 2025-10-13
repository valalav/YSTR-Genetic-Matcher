// Simple test script to verify search works
const fetch = require('node-fetch');

async function testSearch() {
  console.log('🔍 Testing search for kit 39666...\n');

  // 1. Get profile
  console.log('📡 Step 1: Fetching profile...');
  const profileRes = await fetch('http://localhost:9004/api/profiles/39666');
  const profileData = await profileRes.json();
  console.log('✅ Profile found:', profileData.profile.kitNumber, profileData.profile.name);
  console.log('   Markers:', Object.keys(profileData.profile.markers).length);

  // 2. Search for matches
  console.log('\n📡 Step 2: Searching for matches...');
  const searchRes = await fetch('http://localhost:9004/api/profiles/find-matches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      markers: profileData.profile.markers,
      maxDistance: 25,
      maxResults: 50
    })
  });

  const searchData = await searchRes.json();
  console.log('✅ Search complete!');
  console.log('   Total matches:', searchData.total);
  console.log('   Matches returned:', searchData.matches.length);

  if (searchData.matches.length > 0) {
    console.log('\n📊 First 5 matches:');
    searchData.matches.slice(0, 5).forEach((match, i) => {
      console.log(`   ${i+1}. Kit ${match.profile.kitNumber} - ${match.profile.name} (${match.profile.country})`);
      console.log(`      Distance: ${match.distance}, Identity: ${match.percentIdentical}%`);
    });
  }
}

testSearch().catch(console.error);
