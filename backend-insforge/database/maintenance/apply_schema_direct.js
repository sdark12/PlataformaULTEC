const https = require('https');
const fs = require('fs');

const apiKey = 'ik_7cd30952e8b97a858e40b4decf41f231';
const projectId = 'x686ikci';
const hostname = `${projectId}.us-east.insforge.app`;
const pathUrl = '/api/database/advance/rawsql';

const schemaPath = 'C:\\Users\\saul_\\.gemini\\antigravity\\brain\\417e9c36-495a-4e50-9efb-a0297964386c\\schema.sql';

try {
    const sql = fs.readFileSync(schemaPath, 'utf8');

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
