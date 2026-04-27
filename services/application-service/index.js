const express = require('express');
const axios = require('axios');
const { initDB, getApplicationRepository } = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

const JOBS_SERVICE_URL = process.env.JOBS_SERVICE_URL;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL;

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const isValidDateString = (value) => {
    if (!isNonEmptyString(value)) {
        return false;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
};

const mapApplicationResponse = (application) => ({
    id: application.id,
    jobId: application.job_id,
    candidateId: application.candidate_id,
    status: application.status,
    createdAt: application.created_at
});

app.post('/api/v1/application/apply', async (req, res) => {
    const { jobId, candidateId, resume, coverLetter, phoneNumber, preferredStartDate } = req.body;

    if (!isNonEmptyString(jobId)) {
        return res.status(400).json({ error: 'jobId is required' });
    }

    if (candidateId === undefined || candidateId === null || `${candidateId}`.trim() === '') {
        return res.status(400).json({ error: 'candidateId is required' });
    }

    if (!isNonEmptyString(resume)) {
        return res.status(400).json({ error: 'resume is required' });
    }

    if (!isNonEmptyString(phoneNumber)) {
        return res.status(400).json({ error: 'phoneNumber is required' });
    }

    if (preferredStartDate && !isValidDateString(preferredStartDate)) {
        return res.status(400).json({ error: 'preferredStartDate must use YYYY-MM-DD format' });
    }

    try {
        const jobsResponse = await axios.get(`${JOBS_SERVICE_URL}/api/v1/jobs`);
        const matchingJob = Array.isArray(jobsResponse.data)
            ? jobsResponse.data.find((job) => `${job.id}` === `${jobId}`)
            : null;

        if (!matchingJob) {
            return res.status(404).json({
                error: 'JOB_NOT_FOUND',
                message: `Published job ${jobId} was not found.`
            });
        }

        const applicationRepository = getApplicationRepository();
        const application = applicationRepository.create({
            job_id: `${jobId}`,
            candidate_id: `${candidateId}`,
            resume: resume.trim(),
            cover_letter: isNonEmptyString(coverLetter) ? coverLetter.trim() : null,
            phone_number: phoneNumber.trim(),
            preferred_start_date: preferredStartDate || null,
            status: 'SUBMITTED',
            saga_state: 'SUBMITTED'
        });

        const savedApplication = await applicationRepository.save(application);

        return res.status(201).json(mapApplicationResponse(savedApplication));
    } catch (error) {
        console.error('Application submission failed:', error.message);
        return res.status(500).json({
            error: 'APPLICATION_SUBMISSION_FAILED',
            message: error.response ? error.response.data : error.message
        });
    }
});

// The Saga Orchestrator Endpoint
app.post('/api/v1/application/post-job', async (req, res) => {
    const { employer_id, job_details, payment_details } = req.body;
    let createdJobId = null;
    let sagaId = null;

    try {
        const applicationRepository = getApplicationRepository();

        // STEP 0: Initialize Saga State in Database
        console.log("Saga Step 0: Initializing Saga in Database...");
        const saga = await applicationRepository.save(
            applicationRepository.create({
                candidate_id: employer_id,
                status: 'POSTING_JOB',
                saga_state: 'STARTED'
            })
        );
        sagaId = saga.id;

        // STEP 1: Create Draft Job
        console.log(`Saga Step 1: Creating Draft Job (Saga Tracking ID: ${sagaId})...`);
        const jobResponse = await axios.post(`${JOBS_SERVICE_URL}/api/v1/jobs`, {
            employer_id,
            ...job_details
        });
        createdJobId = jobResponse.data.id;

        // Update Saga State: Draft Success
        await applicationRepository.update(
            { id: sagaId },
            { job_id: createdJobId, saga_state: 'DRAFT_CREATED' }
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
        await applicationRepository.update(
            { id: sagaId },
            { saga_state: 'COMPLETED', status: 'PUBLISHED' }
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
                    await applicationRepository.update(
                        { id: sagaId },
                        { saga_state: 'ROLLED_BACK', status: 'FAILED' }
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
            const applicationRepository = getApplicationRepository();
            await applicationRepository.update({ id: sagaId }, { saga_state: 'SYSTEM_ERROR' });
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
}).catch((error) => {
    console.error('Failed to initialize application-service database:', error.message);
    process.exit(1);
});