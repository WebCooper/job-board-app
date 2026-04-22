const express = require('express');
const axios = require('axios');
const { pool, initDB } = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

const JOBS_SERVICE_URL = process.env.JOBS_SERVICE_URL;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL;

// The Saga Orchestrator Endpoint
app.post('/api/v1/application/post-job', async (req, res) => {
    const { employer_id, job_details, payment_details } = req.body;
    let createdJobId = null;
    let sagaId = null;

    try {
        // STEP 0: Initialize Saga State in Database
        console.log("Saga Step 0: Initializing Saga in Database...");
        const sagaResult = await pool.query(
            `INSERT INTO applications (candidate_id, status, saga_state) 
             VALUES ($1, 'POSTING_JOB', 'STARTED') RETURNING id`,
            [employer_id]
        );
        sagaId = sagaResult.rows[0].id;

        // STEP 1: Create Draft Job
        console.log(`Saga Step 1: Creating Draft Job (Saga Tracking ID: ${sagaId})...`);
        const jobResponse = await axios.post(`${JOBS_SERVICE_URL}/api/v1/jobs`, {
            employer_id,
            ...job_details
        });
        createdJobId = jobResponse.data.id;

        // Update Saga State: Draft Success
        await pool.query(
            `UPDATE applications SET job_id = $1, saga_state = 'DRAFT_CREATED' WHERE id = $2`,
            [createdJobId, sagaId]
        );

        // STEP 2: Process Payment
        console.log(`Saga Step 2: Processing Payment for Job ${createdJobId}...`);
        const paymentResponse = await axios.post(`${PAYMENT_SERVICE_URL}/api/v1/payments/charge`, {
            employer_id,
            job_id: createdJobId,
            amount: payment_details.amount
        });

        // STEP 3: Publish Job (If Payment Succeeds)
        console.log("Payment Successful! Saga Step 3: Publishing Job...");
        await axios.put(`${JOBS_SERVICE_URL}/api/v1/jobs/${createdJobId}/publish`);

        // Update Saga State: Completed
        await pool.query(
            `UPDATE applications SET saga_state = 'COMPLETED', status = 'PUBLISHED' WHERE id = $1`,
            [sagaId]
        );

        // TODO in Phase 4: Publish RabbitMQ Event here (Notification Service)

        return res.status(201).json({
            message: "Job successfully published.",
            job_id: createdJobId,
            payment_status: paymentResponse.data.status,
            saga_status: "COMPLETED"
        });

    } catch (error) {
        console.error("Saga Failed at a step. Initiating compensation...");

        // If failure happened at Step 2 (Payment Failed/Insufficient Funds)
        if (createdJobId && error.response && error.response.status === 402) {
            console.log(`Compensating Transaction: Deleting Draft Job ${createdJobId}...`);
            try {
                // Rollback Step 1: Delete Draft
                await axios.delete(`${JOBS_SERVICE_URL}/api/v1/jobs/${createdJobId}`);

                // Rollback Step 2: Update Saga State to reflect the successful rollback
                if (sagaId) {
                    await pool.query(
                        `UPDATE applications SET saga_state = 'ROLLED_BACK', status = 'FAILED' WHERE id = $1`,
                        [sagaId]
                    );
                }

                return res.status(402).json({
                    error: "PAYMENT_FAILED",
                    message: "Card declined. The draft job has been removed (Rollback successful).",
                    payment_status: "FAILED",
                    saga_status: "ROLLED_BACK"
                });
            } catch (rollbackError) {
                console.error("CRITICAL ALARM: Rollback failed! System in inconsistent state.", rollbackError.message);
                // In a production environment, this would trigger an alert for manual developer intervention.
                return res.status(500).json({ error: "System error during rollback." });
            }
        }

        // Catch-all for other unexpected errors (e.g., Jobs service is completely down)
        if (sagaId) {
            await pool.query(`UPDATE applications SET saga_state = 'SYSTEM_ERROR' WHERE id = $1`, [sagaId]);
        }

        return res.status(500).json({
            error: "SAGA_FAILED",
            details: error.response ? error.response.data : error.message
        });
    }
});

const PORT = process.env.PORT || 3003;
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Application Service (Saga Orchestrator) running on port ${PORT}`);
    });
});