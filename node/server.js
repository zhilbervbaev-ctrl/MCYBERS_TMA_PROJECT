const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
// Database Connection configuration
// Uses environment variables with local fallbacks for development
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '', // This needs to be set in the environment
    database: process.env.DB_NAME || 'TMA',
    port: 3306
};

const pool = mysql.createPool(dbConfig);
const promisePool = pool.promise();

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Get scan results for a specific domain
app.get('/api/scan/:domain', async (req, res) => {
    const domain = req.params.domain;
    if (!domain) {
        return res.status(400).json({ error: 'Domain is required' });
    }

    try {
        // We look for the most recent result for this hostname
        const [rows] = await promisePool.query(
            'SELECT * FROM host_results WHERE hostname = ? OR hostname LIKE ? ORDER BY created_at DESC LIMIT 1',
            [domain, `%${domain}%`]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'No scan results found for this domain.' });
        }

        const result = rows[0];

        // The 'results' column contains the JSON string from the Java Scanner
        let parsedResults;
        try {
            // Clean up the string if it has markdown code blocks
            let jsonString = result.results;
            if (jsonString.startsWith('```json')) {
                jsonString = jsonString.replace(/^```json/, '').replace(/```$/, '');
            } else if (jsonString.startsWith('```')) {
                jsonString = jsonString.replace(/^```/, '').replace(/```$/, '');
            }
            parsedResults = JSON.parse(jsonString);
        } catch (e) {
            console.error("Failed to parse JSON content from DB:", e);
            parsedResults = { raw: result.results, error: "Failed to parse JSON" };
        }

        res.json({
            id: result.id,
            hostname: result.hostname,
            created_at: result.created_at,
            data: parsedResults
        });

    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Debug: Connecting to DB at ${dbConfig.host} as ${dbConfig.user}`);
});
