const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'matchingService.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the line with "} = options;" and add validation after it
const searchString = '    } = options;';
const validationCode = `
    // CRITICAL FIX: Validate marker values are numeric (prevents 40x slowdown)
    for (const [marker, value] of Object.entries(queryMarkers)) {
      if (value && !/^[0-9]+(\\.[0-9]+)?$/.test(value.toString())) {
        throw new Error(\`Invalid marker value for \${marker}: "\${value}" - must be numeric\`);
      }
    }
`;

if (content.includes(searchString)) {
  content = content.replace(searchString, searchString + validationCode);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Validation added successfully to matchingService.js');
} else {
  console.log('❌ Could not find insertion point');
  process.exit(1);
}
