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
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '');
            } else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '');
            }

            const parsed = JSON.parse(jsonStr);
            const checklist = parsed.audit_checklist || parsed.checklist || [];

            console.log("=== CHECKLIST CATEGORIES IN DB ===");
            console.log("Total items:", checklist.length);

            // Collect unique categories
            const uniqueCats = [...new Set(checklist.map(i => i.category))];
            uniqueCats.forEach(cat => console.log(`"${cat}"`));

        } catch (e) {
            console.log("Error parsing JSON:", e.message);
        }
    } else {
        console.log("No results found");
    }
    connection.end();
});
