const http = require('http');
const fs = require('fs');

const tests = [
  {
    name: "Test 1: Full database search (no filter)",
    file: "test-match-request.json"
  },
  {
    name: "Test 2: Haplogroup I-M253 filter (24,181 profiles)",
    file: "test-performance.json"
  }
];

async function runTest(testConfig) {
  const data = fs.readFileSync(testConfig.file, 'utf8');

  return new Promise((resolve, reject) => {
    const start = Date.now();

    const options = {
      hostname: 'localhost',
      port: 9004,
      path: '/api/profiles/find-matches',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - start;
        const result = JSON.parse(responseData);

        console.log(`\n${testConfig.name}`);
        console.log(`Duration: ${duration}ms`);
        console.log(`Matches found: ${result.total || result.matches?.length || 0}`);
        console.log(`---`);

        resolve({ test: testConfig.name, duration, matchesCount: result.total });
      });
    });

    req.on('error', (e) => {
      console.error(`Error in ${testConfig.name}:`, e);
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== PostgreSQL YSTR Matcher Performance Tests ===\n');

  const results = [];

  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n=== Summary ===');
  results.forEach(r => {
    console.log(`${r.test}: ${r.duration}ms (${r.matchesCount} matches)`);
  });
}

main().catch(console.error);
