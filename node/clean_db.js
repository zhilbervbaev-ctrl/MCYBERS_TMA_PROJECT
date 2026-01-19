
const mysql = require('mysql2');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DB_NAME || 'TMA',
    port: 3306
};

const connection = mysql.createConnection(dbConfig);

connection.connect(err => {
    if (err) {
        console.error('Error connecting: ' + err.stack);
        return;
    }
    console.log('Connected as id ' + connection.threadId);

    connection.query("DELETE FROM host_results", (error, results) => {
        if (error) throw error;
        console.log('Deleted rows:', results.affectedRows);
        connection.end();
    });
});
