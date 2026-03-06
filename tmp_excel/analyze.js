const xlsx = require('xlsx');
const fs = require('fs');

const files = [
    'C:\\Users\\saul_\\Downloads\\Datos Personales.xlsx',
    'C:\\Users\\saul_\\Downloads\\Tabla1.xlsx',
    'C:\\Users\\saul_\\Downloads\\recibo.xlsx',
    'C:\\Users\\saul_\\Downloads\\pagos.xlsx'
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        try {
            const workbook = xlsx.readFile(file);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet);
            console.log(`\n=========================================`);
            console.log(`FILE: ${file}`);
            console.log(`Total Rows: ${data.length}`);
            if (data.length > 0) {
                console.log(`Columns (${Object.keys(data[0]).length}): \n  - ${Object.keys(data[0]).join('\n  - ')}`);
                console.log(`Sample Row[0]:`);
                console.log(JSON.stringify(data[0], null, 2));
            }
        } catch (e) {
            console.error(`Error reading ${file}:`, e);
        }
    } else {
        console.log(`\n=========================================`);
        console.log(`FILE NOT FOUND: ${file}`);
    }
});
