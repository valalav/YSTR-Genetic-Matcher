const https = require('https');
const fs = require('fs');
const path = require('path');

const urls = [
  {
    name: 'aadna',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTp8VNm5yS63RiflBpMY4b8d4RBTPecjU_RrC10EDcgSitcQxRtt1QbeN67g8bYOyqB088GLOTHIG5g/pub?gid=90746110&single=true&output=csv',
    filename: 'downloads/aadna.csv'
  }
];

function download(url, filename) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading ${filename}...`);

    const file = fs.createWriteStream(filename);

    function makeRequest(requestUrl) {
      https.get(requestUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          console.log(`🔄 Redirect to: ${res.headers.location}`);
          file.destroy();
          return makeRequest(res.headers.location);
        }

        if (res.statusCode === 200) {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            const stats = fs.statSync(filename);
            console.log(`✅ Downloaded ${filename} (${Math.round(stats.size/1024)}KB)`);
            resolve();
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      }).on('error', reject);
    }

    makeRequest(url);
  });
}

async function main() {
  for (const item of urls) {
    try {
      await download(item.url, item.filename);
    } catch (err) {
      console.error(`❌ Failed to download ${item.name}:`, err.message);
    }
  }
}

main();
