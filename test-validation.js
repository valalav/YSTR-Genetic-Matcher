const http = require('http');

async function testValidation() {
  console.log('=== TESTING MARKER VALIDATION ===\n');

  const tests = [
    {
      name: 'Valid markers (should work)',
      data: {
        markers: {"DYS19": "14", "DYS390": "21"},
        maxDistance: 5,
        maxResults: 10
      }
    },
    {
      name: 'Invalid markers - letters (should fail)',
      data: {
        markers: {"DYS19": "abc", "DYS390": "21"},
        maxDistance: 5,
        maxResults: 10
      }
    },
    {
      name: 'Invalid markers - negative (should fail)',
      data: {
        markers: {"DYS19": "14", "DYS390": "-1"},
        maxDistance: 5,
        maxResults: 10
      }
    },
    {
      name: 'Invalid markers - special chars (should fail)',
      data: {
        markers: {"DYS19": "14; DROP TABLE", "DYS390": "21"},
        maxDistance: 5,
        maxResults: 10
      }
    }
  ];

  for (const test of tests) {
    const data = JSON.stringify(test.data);
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
              success: result.success !== false,
              duration,
              statusCode: res.statusCode,
              error: result.error,
              matches: result.matches ? result.matches.length : 0
            });
          } catch (e) {
            resolve({
              success: false,
              duration,
              statusCode: res.statusCode,
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

    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
    console.log(`   Status: ${result.statusCode}`);
    console.log(`   Duration: ${result.duration}ms`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    } else if (result.matches !== undefined) {
      console.log(`   Matches: ${result.matches}`);
    }
    console.log('');

    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

testValidation().catch(console.error);
