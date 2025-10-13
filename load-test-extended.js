const http = require('http');

// Extended load test with more users
const CONCURRENT_USERS = 20;  // Increased from 10
const REQUESTS_PER_USER = 5;

const testQueries = [
  {
    markers: {"DYS19": "14", "DYS390": "21", "DYS391": "10"},
    maxDistance: 5,
    maxResults: 100
  },
  {
    markers: {"DYS19": "14", "DYS390": "21", "DYS391": "10"},
    maxDistance: 5,
    maxResults: 100,
    haplogroupFilter: "I-M253"
  },
  {
    markers: {"DYS19": "15", "DYS390": "22", "DYS391": "11"},
    maxDistance: 3,
    maxResults: 50
  },
  {
    markers: {"DYS393": "13", "DYS390": "24"},
    maxDistance: 7,
    maxResults: 100,
    haplogroupFilter: "E-M35"
  },
  {
    markers: {"DYS19": "13", "DYS390": "23", "DYS391": "9", "DYS392": "14"},
    maxDistance: 10,
    maxResults: 200
  }
];

async function makeRequest(queryData) {
  const data = JSON.stringify(queryData);

  return new Promise((resolve) => {
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
          resolve({
            success: result.success,
            duration,
            matches: result.matches ? result.matches.length : 0
          });
        } catch (e) {
          resolve({
            success: false,
            duration,
            error: 'Parse error'
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        success: false,
        error: e.message
      });
    });

    req.write(data);
    req.end();
  });
}

async function simulateUser(userId) {
  const results = [];

  for (let i = 0; i < REQUESTS_PER_USER; i++) {
    const query = testQueries[i % testQueries.length];
    const result = await makeRequest(query);
    results.push(result);

    // Small random delay between requests (0-100ms)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
  }

  return {
    userId,
    results,
    totalDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
    avgDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length,
    successCount: results.filter(r => r.success).length
  };
}

async function main() {
  console.log('=== EXTENDED LOAD TEST: 20 CONCURRENT USERS ===\n');
  console.log(`Simulating ${CONCURRENT_USERS} concurrent users`);
  console.log(`Each making ${REQUESTS_PER_USER} requests`);
  console.log(`Total requests: ${CONCURRENT_USERS * REQUESTS_PER_USER}\n`);

  const startTime = Date.now();

  // Launch all users concurrently
  const userPromises = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    userPromises.push(simulateUser(i + 1));
  }

  const userResults = await Promise.all(userPromises);

  const totalTime = Date.now() - startTime;

  console.log('\n=== USER RESULTS ===');
  userResults.forEach(user => {
    const icon = user.successCount === REQUESTS_PER_USER ? '✅' : '⚠️';
    console.log(`${icon} User ${user.userId}: ${user.successCount}/${REQUESTS_PER_USER} successful, avg ${user.avgDuration.toFixed(1)}ms`);
  });

  // Aggregate statistics
  const allResults = userResults.flatMap(u => u.results);
  const successful = allResults.filter(r => r.success);
  const failed = allResults.filter(r => !r.success);

  console.log('\n=== AGGREGATE STATISTICS ===');
  console.log(`Total requests: ${allResults.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Success rate: ${((successful.length / allResults.length) * 100).toFixed(1)}%`);
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Throughput: ${(allResults.length / (totalTime / 1000)).toFixed(2)} req/sec`);

  if (successful.length > 0) {
    const durations = successful.map(r => r.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const p50 = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.5)];
    const p95 = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];
    const p99 = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.99)];

    console.log('\n=== RESPONSE TIME STATISTICS ===');
    console.log(`Average: ${avgDuration.toFixed(1)}ms`);
    console.log(`Min: ${minDuration}ms`);
    console.log(`Max: ${maxDuration}ms`);
    console.log(`P50 (median): ${p50}ms`);
    console.log(`P95: ${p95}ms`);
    console.log(`P99: ${p99}ms`);

    // Performance assessment
    console.log('\n=== PERFORMANCE ASSESSMENT ===');
    if (p95 < 100) {
      console.log('✅ EXCELLENT: P95 < 100ms - Production ready');
    } else if (p95 < 500) {
      console.log('✅ GOOD: P95 < 500ms - Acceptable for production');
    } else if (p95 < 1000) {
      console.log('⚠️  WARNING: P95 < 1000ms - May need optimization');
    } else {
      console.log('❌ CRITICAL: P95 > 1000ms - Requires immediate optimization');
    }

    if (avgDuration < 50) {
      console.log('✅ EXCELLENT: Average < 50ms');
    } else if (avgDuration < 200) {
      console.log('✅ GOOD: Average < 200ms');
    } else {
      console.log('⚠️  WARNING: Average > 200ms - Consider optimization');
    }
  }

  if (failed.length > 0) {
    console.log('\n❌ FAILURES:');
    console.log(`${failed.length} requests failed`);
    const errors = {};
    failed.forEach(f => {
      const err = f.error || 'Unknown';
      errors[err] = (errors[err] || 0) + 1;
    });
    Object.entries(errors).forEach(([err, count]) => {
      console.log(`  - ${err}: ${count} times`);
    });
  }
}

main().catch(console.error);
