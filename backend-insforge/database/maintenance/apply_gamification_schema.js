const https = require('https');
const fs = require('fs');
const path = require('path');

const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxOTQ2NTJ9.LsB4ffiFE5H7qEfhgnM0NuPTX_It2aYd4iEmVUOHmh4';
const projectId = 'w6x267sp';
const hostname = `${projectId}.us-east.insforge.app`;
const pathUrl = '/api/database/advance/rawsql';

const schemaPath = path.join(__dirname, '../../create_gamification_tables.sql');

try {
    let sql = fs.readFileSync(schemaPath, 'utf8');

    // Add API REST grants and reload schema cache
    sql += `
-- GRANTS FOR REST API
GRANT ALL ON TABLE rewards TO authenticated;
GRANT ALL ON TABLE rewards TO anon;
GRANT ALL ON TABLE rewards TO postgres;

GRANT ALL ON TABLE merit_transactions TO authenticated;
GRANT ALL ON TABLE merit_transactions TO anon;
GRANT ALL ON TABLE merit_transactions TO postgres;

-- RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
`;

    const data = JSON.stringify({
      query: sql
    });

    const options = {
      hostname: hostname,
      path: pathUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    };

    console.log(`Sending SQL to https://${hostname}${pathUrl}...`);

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${body}`);
        if (res.statusCode === 200) {
            console.log('SQL Executed successfully! Gamification tables are ready!');
        } else {
            console.error('Failed to execute SQL.');
        }
      });
    });

    req.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
    });

    req.write(data);
    req.end();
} catch (err) {
    console.error('Error reading schema file:', err);
}
