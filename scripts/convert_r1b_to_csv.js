const XLSX = require('xlsx');
const fs = require('fs');

console.log('Converting R1b.xlsx to CSV...');
console.time('Conversion');

// Read with cellStyles: false to speed up
const workbook = XLSX.readFile('../R1b.xlsx', {
  cellStyles: false,
  cellFormula: false,
  cellHTML: false
});

console.log('Sheets:', workbook.SheetNames);

const sheetName = workbook.SheetNames[0];
const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);

fs.writeFileSync('downloads/r1b.csv', csv, 'utf8');

const lines = csv.split('\n').length;
console.log(`Converted ${lines} lines`);
console.timeEnd('Conversion');
