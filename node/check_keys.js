const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DB_NAME || 'TMA'
});

connection.connect();

connection.query("SELECT results FROM host_results WHERE hostname LIKE '%elmundo.es%' ORDER BY created_at DESC LIMIT 1", (error, results) => {
    if (error) throw error;
    if (results.length > 0) {
        try {
            let jsonStr = results[0].results;
            // cleanup markdown like server.js does
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '');
            } else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '');
            }

            const parsed = JSON.parse(jsonStr);
            console.log("Top level keys:", Object.keys(parsed));
            if (parsed.audit_metadata) console.log("Has audit_metadata");
            if (parsed.audit_checklist) console.log("Has audit_checklist with length:", parsed.audit_checklist.length);
            if (parsed.checklist) console.log("Has checklist with length:", parsed.checklist.length);
        } catch (e) {
            console.log("Error parsing JSON:", e.message);
            console.log("Raw start:", results[0].results.substring(0, 100));
        }
    } else {
        console.log("No results found");
    }
    connection.end();
});
