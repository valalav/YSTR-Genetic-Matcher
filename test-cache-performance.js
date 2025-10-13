const http = require('http');

async function testCachePerformance() {
  console.log('=== TESTING CACHE PERFORMANCE ===\n');

  const testQuery = {
    markers: {"DYS19": "14", "DYS390": "21", "DYS391": "10"},
    maxDistance: 5,
    maxResults: 50
  };

  console.log('Running same query 10 times to test cache...\n');

  const results = [];

  for (let i = 1; i <= 10; i++) {
    const data = JSON.stringify(testQuery);
    const start = Date.now();

    const result = await new Promise((resolve) => {
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
              iteration: i,
              success: result.success,
              duration,
              matches: result.matches ? result.matches.length : 0,
              cached: res.headers['x-cache-hit']
            });
          } catch (e) {
            resolve({
              iteration: i,
              success: false,
              duration,
              error: 'Parse error'
            });
          }
        });
      });

      req.on('error', (e) => {
        resolve({
          iteration: i,
          success: false,
          error: e.message
        });
      });

      req.write(data);
      req.end();
    });

    results.push(result);
    console.log(`Request ${i}: ${result.duration}ms (${result.matches} matches)`);

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('\n=== CACHE PERFORMANCE ANALYSIS ===');
  const durations = results.filter(r => r.success).map(r => r.duration);

  if (durations.length > 0) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    console.log(`Average: ${avg.toFixed(1)}ms`);
    console.log(`Min: ${min}ms`);
    console.log(`Max: ${max}ms`);

    // First request is usually cache miss, rest should be hits
    if (durations.length > 1) {
      const firstRequest = durations[0];
      const subsequentRequests = durations.slice(1);
      const avgSubsequent = subsequentRequests.reduce((a, b) => a + b, 0) / subsequentRequests.length;

      console.log(`\nFirst request (likely cache miss): ${firstRequest}ms`);
      console.log(`Subsequent requests (cache hits): ${avgSubsequent.toFixed(1)}ms avg`);

      if (avgSubsequent > 100) {
        console.log('\n⚠️  WARNING: Cache hits are slower than expected (>100ms)');
        console.log('   This suggests a problem with Redis or serialization');
      } else if (avgSubsequent < 10) {
        console.log('\n✅ EXCELLENT: Cache is working optimally (<10ms)');
      } else {
        console.log('\n✅ GOOD: Cache is working well');
      }
    }
  }
}

testCachePerformance().catch(console.error);
