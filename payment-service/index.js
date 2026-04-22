const express = require('express');
const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

// Placeholder for charging an employer
app.post('/payments/charge', (req, res) => {
    res.status(200).json({ message: "Payment Service: Placeholder for charging payment" });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok", service: "payment-service" });
});

app.listen(PORT, () => {
    console.log(`Payment Service running on port ${PORT}`);
});