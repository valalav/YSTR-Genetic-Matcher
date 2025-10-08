const http = require('http');

const tests = [
  {
    name: "Health Check",
    method: 'GET',
    path: '/health'
  },
  {
    name: "Database Stats",
    method: 'GET',
    path: '/api/profiles/stats/database'
  },
  {
    name: "Haplogroups List",
    method: 'GET',
    path: '/api/databases/haplogroups?minProfiles=1000'
  },
  {
    name: "Haplogroup Stats - I-M253",
    method: 'GET',
    path: '/api/databases/haplogroup-stats/I-M253'
  },
  {
    name: "Get Profile - Valid Kit",
    method: 'GET',
    path: '/api/profiles/100055'
  },
  {
    name: "Get Profile - Invalid Kit",
    method: 'GET',
    path: '/api/profiles/999999999'
  },
  {
    name: "Find Matches - Normal",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"DYS19": "14", "DYS390": "21", "DYS391": "10"},
      maxDistance: 5,
      maxResults: 50
    }
  },
  {
    name: "Find Matches - With Filter",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"DYS19": "14", "DYS390": "21", "DYS391": "10"},
      maxDistance: 5,
      maxResults: 50,
      haplogroupFilter: "I-M253"
    }
  },
  {
    name: "Find Matches - Empty Markers (Edge Case)",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {},
      maxDistance: 5,
      maxResults: 50
    }
  },
  {
    name: "Find Matches - Invalid Haplogroup",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"DYS19": "14"},
      maxDistance: 5,
      maxResults: 50,
      haplogroupFilter: "INVALID-HAPLO-999"
    }
  },
  {
    name: "Find Matches - Single Marker",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"DYS19": "14"},
      maxDistance: 0,
      maxResults: 10
    }
  },
  {
    name: "Find Matches - Large Distance",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"DYS19": "14", "DYS390": "21"},
      maxDistance: 100,
      maxResults: 1000
    }
  },
  {
    name: "Find Matches - Zero Distance",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"DYS19": "14", "DYS390": "21", "DYS391": "10"},
      maxDistance: 0,
      maxResults: 50
    }
  },
  {
    name: "Find Matches - Invalid Marker Values",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"DYS19": "abc", "DYS390": "-1"},
      maxDistance: 5,
      maxResults: 50
    }
  },
  {
    name: "Find Matches - Negative Distance",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"DYS19": "14"},
      maxDistance: -5,
      maxResults: 50
    }
  }
];

async function runTest(test) {
  const data = test.data ? JSON.stringify(test.data) : null;

  return new Promise((resolve) => {
    const start = Date.now();

    const options = {
      hostname: 'localhost',
      port: 9004,
      path: test.path,
      method: test.method,
      headers: data ? {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      } : {}
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
          resolve({
            name: test.name,
            statusCode: res.statusCode,
            duration,
            success: result.success !== false && res.statusCode === 200,
            dataSize: responseData.length,
            result: result
          });
        } catch (e) {
          resolve({
            name: test.name,
            statusCode: res.statusCode,
            duration,
            success: false,
            error: 'Parse error: ' + e.message,
            dataSize: responseData.length
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        name: test.name,
        success: false,
        error: e.message
      });
    });

    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== CRITICAL API ENDPOINT TESTING ===\n');

  const results = [];

  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);

    const icon = result.success ? '✅' : '❌';
    const status = result.statusCode || 'ERR';

    console.log(`${icon} [${status}] ${result.name}`);
    console.log(`   Duration: ${result.duration}ms`);

    if (result.success && result.result) {
      if (result.result.matches) {
        console.log(`   Matches: ${result.result.matches.length}`);
      } else if (result.result.haplogroups) {
        console.log(`   Haplogroups: ${result.result.haplogroups.length}`);
      } else if (result.result.statistics) {
        console.log(`   Total Profiles: ${result.result.statistics.totalProfiles}`);
      } else if (result.result.profile) {
        console.log(`   Kit: ${result.result.profile.kitNumber}`);
      }
    }

    if (result.error) {
      console.log(`   ⚠️  Error: ${result.error}`);
    }

    if (!result.success && result.result && result.result.error) {
      console.log(`   ⚠️  API Error: ${result.result.error}`);
    }

    console.log('');

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('\n=== API TEST SUMMARY ===');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Success Rate: ${((successful.length / results.length) * 100).toFixed(1)}%`);

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
    console.log('\n❌ FAILED TESTS:');
    failed.forEach(r => {
      const reason = r.error || (r.result && r.result.error) || 'Unknown error';
      console.log(`  - ${r.name}: ${reason}`);
    });
  }
}

main().catch(console.error);
