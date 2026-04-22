const express = require('express');
const { pool, initDB } = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

// 1. Create Draft Job
app.post('/api/v1/jobs', async (req, res) => {
    const { employer_id, title, description, salary_min, salary_max } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO jobs (employer_id, title, description, salary_min, salary_max, status) 
             VALUES ($1, $2, $3, $4, $5, 'DRAFT') RETURNING *`,
            [employer_id, title, description, salary_min, salary_max]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Publish Job
app.put('/api/v1/jobs/:id/publish', async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE jobs SET status = 'PUBLISHED' WHERE id = $1 RETURNING *`,
            [req.params.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Job not found" });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Delete Job (Saga Rollback)
app.delete('/api/v1/jobs/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM jobs WHERE id = $1`, [req.params.id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok", service: "jobs-service" });
});


const PORT = process.env.PORT || 3002;
initDB().then(() => {
    app.listen(PORT, () => console.log(`Jobs Service running on port ${PORT}`));
});