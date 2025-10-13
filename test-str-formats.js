const http = require('http');

async function testSTRFormats() {
  console.log('=== TESTING STR VALUE FORMATS ===\n');

  const tests = [
    {
      name: 'Simple integers',
      markers: {"DYS19": "14", "DYS390": "21"}
    },
    {
      name: 'Decimal values',
      markers: {"DYS389I": "12.3", "DYS389II": "28.5"}
    },
    {
      name: 'Range values',
      markers: {"CDY": "33-34", "DYS464": "15-16-17-18"}
    },
    {
      name: 'Decimal range',
      markers: {"DYS19": "14.2-15.1"}
    },
    {
      name: 'Mixed valid formats',
      markers: {"DYS19": "14", "DYS389I": "12.3", "CDY": "33-34"}
    },
    {
      name: 'Invalid - letters',
      markers: {"DYS19": "abc"}
    },
    {
      name: 'Invalid - SQL injection',
      markers: {"DYS19": "14; DROP TABLE"}
    }
  ];

  for (const test of tests) {
    const data = JSON.stringify({
      markers: test.markers,
      maxDistance: 5,
      maxResults: 10
    });

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
          try {
            const result = JSON.parse(responseData);
            resolve({
              statusCode: res.statusCode,
              success: result.success !== false,
              error: result.error
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              success: false,
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
    const expected = test.name.startsWith('Invalid') ? '❌' : '✅';
    const correct = (result.success && !test.name.startsWith('Invalid')) ||
                   (!result.success && test.name.startsWith('Invalid'));

    console.log(`${icon} ${test.name}: ${result.statusCode} ${correct ? '(CORRECT)' : '(WRONG!)'}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

testSTRFormats().catch(console.error);
