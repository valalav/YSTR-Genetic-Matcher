const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'matchingService.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the validation regex
const oldRegex = '/^[0-9]+(\.[0-9]+)?$/';
const newRegex = '/^[0-9]+(?:\.[0-9]+)?(?:-[0-9]+(?:\.[0-9]+)?)?$/';

content = content.replace(oldRegex, newRegex);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Validation regex fixed to support STR range values (e.g., "33-34", "11.2-12.3")');
