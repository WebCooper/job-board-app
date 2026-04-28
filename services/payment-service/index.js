const express = require('express');
const { initDB, getPaymentRepository } = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

app.post('/api/v1/payments/charge', async (req, res) => {
    const { employer_id, job_id, amount } = req.body;

    // Mock Stripe Logic: 70% chance of success
    const isSuccess = Math.random() < 0.7;
    const status = isSuccess ? 'SUCCESS' : 'FAILED';

    try {
        const paymentRepository = getPaymentRepository();
        const payment = paymentRepository.create({
            employer_id,
            job_id,
            amount,
            status
        });
        const savedPayment = await paymentRepository.save(payment);

        if (isSuccess) {
            res.status(200).json(savedPayment);
        } else {
            res.status(402).json({ error: "Insufficient funds", details: savedPayment });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List payments made by a specific employer
app.get('/api/v1/payments/employer/:employer_id', async (req, res) => {
    try {
        const { employer_id } = req.params;
        const paymentRepository = getPaymentRepository();
        const payments = await paymentRepository.find({
            where: { employer_id },
            order: { created_at: 'DESC' }
        });

        return res.status(200).json(payments);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok", service: "payment-service" });
});

const PORT = process.env.PORT || 3004;
initDB().then(() => {
    app.listen(PORT, () => console.log(`Payment Service running on port ${PORT}`));
}).catch((error) => {
    console.error('Failed to initialize payment-service database:', error.message);
    process.exit(1);
});