const http = require('http');

const tests = [
  {
    name: "Test 1: No filter, small distance",
    data: {
      markers: {"DYS19": "14", "DYS390": "21", "DYS391": "10"},
      maxDistance: 2,
      maxResults: 100
    }
  },
  {
    name: "Test 2: I-M253 filter (24k profiles)",
    data: {
      markers: {"DYS19": "14", "DYS390": "21", "DYS391": "10"},
      maxDistance: 5,
      maxResults: 100,
      haplogroupFilter: "I-M253"
    }
  },
  {
    name: "Test 3: E-M35 filter (10k profiles)",
    data: {
      markers: {"DYS19": "14", "DYS390": "24", "DYS391": "11"},
      maxDistance: 5,
      maxResults: 100,
      haplogroupFilter: "E-M35"
    }
  },
  {
    name: "Test 4: Single marker",
    data: {
      markers: {"DYS19": "14"},
      maxDistance: 0,
      maxResults: 50
    }
  },
  {
    name: "Test 5: Many markers",
    data: {
      markers: {
        "DYS19": "14", "DYS390": "21", "DYS391": "10", "DYS392": "11",
        "DYS393": "12", "DYS388": "15", "DYS389I": "12", "DYS389II": "28",
        "DYS426": "11", "DYS439": "11"
      },
      maxDistance: 3,
      maxResults: 100
    }
  }
];

async function runTest(test) {
  const data = JSON.stringify(test.data);

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

        try {
          const result = JSON.parse(responseData);

          if (result.success) {
            resolve({
              name: test.name,
              duration,
              matches: result.matches.length,
              success: true
            });
          } else {
            resolve({
              name: test.name,
              duration,
              error: result.error,
              success: false
            });
          }
        } catch (e) {
          resolve({
            name: test.name,
            duration,
            error: 'Parse error: ' + e.message,
            success: false
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        name: test.name,
        error: e.message,
        success: false
      });
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== CRITICAL PERFORMANCE TESTS ===\n');

  const results = [];

  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);

    console.log(`${result.success ? '✅' : '❌'} ${result.name}`);
    console.log(`   Duration: ${result.duration}ms`);
    if (result.success) {
      console.log(`   Matches: ${result.matches}`);
    } else {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('=== SUMMARY ===');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total tests: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);

  if (successful.length > 0) {
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
    const maxDuration = Math.max(...successful.map(r => r.duration));
    const minDuration = Math.min(...successful.map(r => r.duration));

    console.log(`\nPerformance:`);
    console.log(`  Average: ${avgDuration.toFixed(1)}ms`);
    console.log(`  Min: ${minDuration}ms`);
    console.log(`  Max: ${maxDuration}ms`);
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed tests:`);
    failed.forEach(r => console.log(`  - ${r.name}: ${r.error}`));
  }
}

main().catch(console.error);
