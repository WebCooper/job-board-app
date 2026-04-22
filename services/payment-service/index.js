const express = require('express');
const { pool, initDB } = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

app.post('/api/v1/payments/charge', async (req, res) => {
    const { employer_id, job_id, amount } = req.body;

    // Mock Stripe Logic: 70% chance of success
    const isSuccess = Math.random() < 0.7;
    const status = isSuccess ? 'SUCCESS' : 'FAILED';

    try {
        const result = await pool.query(
            `INSERT INTO payments (employer_id, job_id, amount, status) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [employer_id, job_id, amount, status]
        );

        if (isSuccess) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(402).json({ error: "Insufficient funds", details: result.rows[0] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok", service: "payment-service" });
});

const PORT = process.env.PORT || 3004;
initDB().then(() => {
    app.listen(PORT, () => console.log(`Payment Service running on port ${PORT}`));
});