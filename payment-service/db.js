const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const initDB = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            employer_id VARCHAR(255) NOT NULL,
            job_id VARCHAR(255) NOT NULL,
            amount NUMERIC(10, 2),
            status VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    await pool.query(query);
    console.log("payments_db initialized");
};

module.exports = { pool, initDB };