const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const initDB = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS applications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id VARCHAR(255),
            candidate_id VARCHAR(255),
            status VARCHAR(50), 
            saga_state VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    await pool.query(query);
    console.log("applications_db initialized");
};

module.exports = { pool, initDB };