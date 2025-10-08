const http = require('http');

const tests = [
  {
    name: "Find matches - без фильтра",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"DYS19": "14", "DYS390": "21", "DYS391": "10"},
      maxDistance: 5,
      maxResults: 10
    },
    validate: (res) => {
      return res.success && res.matches && res.matches.length > 0;
    }
  },
  {
    name: "Find matches - с фильтром I-M253",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"DYS19": "14", "DYS390": "21"},
      maxDistance: 5,
      maxResults: 10,
      haplogroupFilter: "I-M253"
    },
    validate: (res) => {
      if (!res.success || !res.matches) return false;
      return res.matches.every(m => m.profile.haplogroup === 'I-M253');
    }
  },
  {
    name: "Find matches - с фильтром E-M35",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"DYS19": "14", "DYS390": "24"},
      maxDistance: 5,
      maxResults: 10,
      haplogroupFilter: "E-M35"
    },
    validate: (res) => {
      if (!res.success || !res.matches) return false;
      return res.matches.every(m => m.profile.haplogroup === 'E-M35');
    }
  },
  {
    name: "Find matches - range values (CDY)",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"CDY": "33-34", "DYS19": "14"},
      maxDistance: 5,
      maxResults: 10
    },
    validate: (res) => {
      return res.success && res.matches;
    }
  },
  {
    name: "Find matches - decimal values",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"DYS389I": "12.3", "DYS19": "14"},
      maxDistance: 5,
      maxResults: 10
    },
    validate: (res) => {
      return res.success && res.matches;
    }
  },
  {
    name: "Find matches - пустые маркеры (должен fail)",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {},
      maxDistance: 5,
      maxResults: 10
    },
    validate: (res) => {
      return !res.success || res.error;
    },
    expectError: true
  },
  {
    name: "Find matches - некорректные значения (должен fail)",
    method: 'POST',
    path: '/api/profiles/find-matches',
    data: {
      markers: {"DYS19": "abc"},
      maxDistance: 5,
      maxResults: 10
    },
    validate: (res) => {
      return !res.success || res.error;
    },
    expectError: true
  },
  {
    name: "Get profile - существующий",
    method: 'GET',
    path: '/api/profiles/100055',
    validate: (res) => {
      return res.success && res.profile && res.profile.kitNumber === '100055';
    }
  },
  {
    name: "Get profile - несуществующий",
    method: 'GET',
    path: '/api/profiles/999999999',
    validate: (res) => {
      return !res.success && res.error;
    },
    expectError: true
  },
  {
    name: "Database stats",
    method: 'GET',
    path: '/api/profiles/stats/database',
    validate: (res) => {
      return res.success && res.statistics && res.statistics.totalProfiles > 0;
    }
  }
];

async function runTest(test) {
  return new Promise((resolve) => {
    const data = test.data ? JSON.stringify(test.data) : null;

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
        try {
          const result = JSON.parse(responseData);
          const passed = test.validate ? test.validate(result) : (result.success !== false);

          resolve({
            name: test.name,
            passed,
            statusCode: res.statusCode,
            expectError: test.expectError || false,
            result
          });
        } catch (e) {
          resolve({
            name: test.name,
            passed: false,
            error: 'Parse error: ' + e.message
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        name: test.name,
        passed: false,
        error: e.message
      });
    });

    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== COMPREHENSIVE API TESTING ===\n');

  const results = [];

  for (const test of tests) {
    await new Promise(resolve => setTimeout(resolve, 200));  // Avoid rate limit

    const result = await runTest(test);
    results.push(result);

    const icon = result.passed ? '✅' : '❌';
    const expectedText = test.expectError ? '(should fail)' : '';

    console.log(`${icon} ${result.name} ${expectedText}`);
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);

  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Success rate: ${((passed.length / results.length) * 100).toFixed(1)}%`);

  if (failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    failed.forEach(r => console.log(`  - ${r.name}`));
  } else {
    console.log('\n✅ ALL TESTS PASSED!');
  }
}

main().catch(console.error);
