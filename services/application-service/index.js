const express = require('express');
const axios = require('axios');
const amqp = require('amqplib');
const { initDB, getApplicationRepository } = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

const JOBS_SERVICE_URL = process.env.JOBS_SERVICE_URL && process.env.JOBS_SERVICE_URL !== '<no value>'
    ? process.env.JOBS_SERVICE_URL
    : 'http://jobs-service';

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL && process.env.PAYMENT_SERVICE_URL !== '<no value>'
    ? process.env.PAYMENT_SERVICE_URL
    : 'http://payment-service';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const NOTIFICATIONS_QUEUE = 'notifications';

let amqpConnection = null;
let amqpChannel = null;

// Initialize RabbitMQ Connection
const initRabbitMQ = async () => {
    try {
        amqpConnection = await amqp.connect(RABBITMQ_URL);
        amqpChannel = await amqpConnection.createChannel();
        await amqpChannel.assertQueue(NOTIFICATIONS_QUEUE, { durable: true });
        console.log(`Connected to RabbitMQ. Notifications queue ready: ${NOTIFICATIONS_QUEUE}`);
    } catch (error) {
        console.error('Failed to initialize RabbitMQ:', error.message);
        console.warn('Continuing without RabbitMQ. Events will not be published.');
    }
};

// Publish event to RabbitMQ
const publishEvent = async (eventType, payload) => {
    if (!amqpChannel) {
        console.warn(`Event not published (RabbitMQ unavailable): ${eventType}`);
        return;
    }

    try {
        const eventMessage = JSON.stringify({
            eventType,
            timestamp: new Date().toISOString(),
            ...payload
        });

        amqpChannel.sendToQueue(NOTIFICATIONS_QUEUE, Buffer.from(eventMessage), {
            persistent: true,
            contentType: 'application/json'
        });

        console.log(`Event published to RabbitMQ: ${eventType}`);
    } catch (error) {
        console.error(`Failed to publish event ${eventType}:`, error.message);
    }
};

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
    const { employer_id, job_details } = req.body;
    let createdJobId = null;
    let sagaId = null;
    const HARDCODED_POSTING_FEE = 10.00; // Hardcoded $10 charge

    try {
        const applicationRepository = getApplicationRepository();

        // STEP 0: Initialize Saga State in Database
        console.log("═══════════════════════════════════════════════════════════");
        console.log("[SAGA START] Job Posting Saga Initiated");
        console.log(`Employer ID: ${employer_id}`);
        console.log(`Posting Fee: $${HARDCODED_POSTING_FEE}`);
        console.log("[STEP 0] Initializing Saga in Database...");
        const saga = await applicationRepository.save(
            applicationRepository.create({
                candidate_id: employer_id,
                status: 'POSTING_JOB',
                saga_state: 'STARTED'
            })
        );
        sagaId = saga.id;
        console.log(`[STEP 0 ✓] Saga initialized | Saga ID: ${sagaId}`);

        // STEP 1: Create Draft Job
        console.log(`\n[STEP 1] Creating Draft Job via Jobs Service at ${JOBS_SERVICE_URL}...`);
        console.log(`Job Details: ${JSON.stringify(job_details, null, 2)}`);
        const jobResponse = await axios.post(`${JOBS_SERVICE_URL}/api/v1/jobs`, {
            employer_id,
            ...job_details
        });
        createdJobId = jobResponse.data.id;
        console.log(`[STEP 1 ✓] Draft Job Created | Job ID: ${createdJobId}`);
        console.log(`Job Status: ${jobResponse.data.status}`);

        // Update Saga State: Draft Success
        await applicationRepository.update(
            { id: sagaId },
            { job_id: createdJobId, saga_state: 'DRAFT_CREATED' }
        );
        console.log(`[STATE UPDATE ✓] Saga state updated to DRAFT_CREATED`);

        // STEP 2: Process Payment
        console.log(`\n[STEP 2] Processing Payment via Payment Service at ${PAYMENT_SERVICE_URL}...`);
        console.log(`Payment Endpoint: ${PAYMENT_SERVICE_URL}/api/v1/payments/charge`);
        console.log(`Charge Details: employer_id=${employer_id}, job_id=${createdJobId}, amount=$${HARDCODED_POSTING_FEE}`);
        
        const paymentResponse = await axios.post(`${PAYMENT_SERVICE_URL}/api/v1/payments/charge`, {
            employer_id,
            job_id: createdJobId,
            amount: HARDCODED_POSTING_FEE
        });
        
        console.log(`[STEP 2 ✓] Payment Processed | Payment Status: ${paymentResponse.data.status}`);
        console.log(`Payment Response: ${JSON.stringify(paymentResponse.data, null, 2)}`);

        // STEP 3: Publish Job (If Payment Succeeds)
        console.log(`\n[STEP 3] Publishing Job (making it visible to candidates)...`);
        console.log(`Publishing endpoint: ${JOBS_SERVICE_URL}/api/v1/jobs/${createdJobId}/publish`);
        await axios.put(`${JOBS_SERVICE_URL}/api/v1/jobs/${createdJobId}/publish`);
        console.log(`[STEP 3 ✓] Job Published Successfully`);

        // Update Saga State: Completed
        await applicationRepository.update(
            { id: sagaId },
            { saga_state: 'COMPLETED', status: 'PUBLISHED' }
        );
        console.log(`[STATE UPDATE ✓] Saga state updated to COMPLETED`);

        // STEP 4: Publish RabbitMQ Event
        console.log(`\n[STEP 4] Publishing job.published event to RabbitMQ Notifications Queue...`);
        await publishEvent('job.published', {
            job_id: createdJobId,
            employer_id,
            job_title: job_details.title,
            amount: HARDCODED_POSTING_FEE,
            payment_status: paymentResponse.data.status,
            saga_id: sagaId
        });
        console.log(`[STEP 4 ✓] Event published to RabbitMQ`);

        console.log(`\n[SAGA SUCCESS ✓] Job posting saga completed successfully`);
        console.log(`═══════════════════════════════════════════════════════════\n`);
        
        return res.status(201).json({
            message: "Job successfully published.",
            job_id: createdJobId,
            payment_status: paymentResponse.data.status,
            saga_status: "COMPLETED"
        });

    } catch (error) {
        console.error(`\n[SAGA ERROR] Saga Failed at a step. Initiating compensation...`);
        console.error(`Error Details: ${error.message}`);
        if (error.response) {
            console.error(`Response Status: ${error.response.status}`);
            console.error(`Response Data: ${JSON.stringify(error.response.data)}`);
        }

        // If failure happened at Step 2 (Payment Failed/Insufficient Funds)
        if (createdJobId && error.response && error.response.status === 402) {
            console.log(`\n[COMPENSATION] Payment failed with 402 status | Initiating draft job deletion...`);
            console.log(`Deleting draft job via: ${JOBS_SERVICE_URL}/api/v1/jobs/${createdJobId}`);
            try {
                // Rollback Step 1: Delete Draft
                await axios.delete(`${JOBS_SERVICE_URL}/api/v1/jobs/${createdJobId}`);
                console.log(`[COMPENSATION ✓] Draft job deleted successfully`);

                // Rollback Step 2: Update Saga State to reflect the successful rollback
                if (sagaId) {
                    await applicationRepository.update(
                        { id: sagaId },
                        { saga_state: 'ROLLED_BACK', status: 'FAILED' }
                    );
                    console.log(`[STATE UPDATE ✓] Saga state updated to ROLLED_BACK`);
                }

                // Publish payment failed event
                console.log(`[EVENT] Publishing job.payment_failed event to RabbitMQ...`);
                await publishEvent('job.payment_failed', {
                    job_id: createdJobId,
                    employer_id,
                    saga_id: sagaId,
                    reason: 'Payment declined - insufficient funds'
                });
                console.log(`[COMPENSATION SUCCESS ✓] Payment failure handled and job removed`);
                console.log(`═══════════════════════════════════════════════════════════\n`);

                return res.status(402).json({
                    error: "PAYMENT_FAILED",
                    message: "Card declined. The draft job has been removed (Rollback successful).",
                    payment_status: "FAILED",
                    saga_status: "ROLLED_BACK"
                });
            } catch (rollbackError) {
                console.error(`\n[CRITICAL ALARM ⚠] Rollback FAILED! System in INCONSISTENT state.`);
                console.error(`Rollback Error: ${rollbackError.message}`);
                console.error(`Orphaned Job ID: ${createdJobId}`);
                console.error(`Orphaned Saga ID: ${sagaId}`);
                
                // Publish system error event
                console.log(`[EVENT] Publishing job.system_error event to RabbitMQ for monitoring...`);
                await publishEvent('job.system_error', {
                    job_id: createdJobId,
                    employer_id,
                    saga_id: sagaId,
                    reason: 'Rollback failed during payment compensation',
                    error_details: rollbackError.message
                });
                console.log(`═══════════════════════════════════════════════════════════\n`);

                return res.status(500).json({ error: "System error during rollback." });
            }
        }

        // Catch-all for other unexpected errors (e.g., Jobs service is completely down)
        console.log(`\n[ERROR PATH] Unexpected error occurred (not payment failure)`);
        if (sagaId) {
            const applicationRepository = getApplicationRepository();
            await applicationRepository.update({ id: sagaId }, { saga_state: 'SYSTEM_ERROR' });
            console.log(`[STATE UPDATE] Saga state set to SYSTEM_ERROR`);
            
            // Publish system error event
            console.log(`[EVENT] Publishing job.system_error event to RabbitMQ for monitoring...`);
            await publishEvent('job.system_error', {
                job_id: createdJobId,
                employer_id,
                saga_id: sagaId,
                reason: 'Unexpected system error',
                error_details: error.message
            });
        }
        console.log(`═══════════════════════════════════════════════════════════\n`);

        return res.status(500).json({
            error: "SAGA_FAILED",
            details: error.response ? error.response.data : error.message
        });
    }
});

const PORT = process.env.PORT || 3003;
initDB().then(async () => {
    await initRabbitMQ();
    app.listen(PORT, () => {
        console.log(`Application Service (Saga Orchestrator) running on port ${PORT}`);
    });
}).catch((error) => {
    console.error('Failed to initialize application-service database:', error.message);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    if (amqpConnection) {
        await amqpConnection.close();
    }
    process.exit(0);
});

// Get applications for a candidate
app.get('/api/v1/application/candidate/:candidateId', async (req, res) => {
    const { candidateId } = req.params;

    if (candidateId === undefined || candidateId === null || `${candidateId}`.trim() === '') {
        return res.status(400).json({ error: 'candidateId is required' });
    }

    try {
        const applicationRepository = getApplicationRepository();
        const applications = await applicationRepository.find({
            where: { candidate_id: `${candidateId}` },
            order: { created_at: 'DESC' }
        });

        return res.status(200).json(Array.isArray(applications) ? applications.map(mapApplicationResponse) : []);
    } catch (error) {
        console.error('Failed to fetch applications for candidate:', error.message);
        return res.status(500).json({ error: 'APPLICATION_FETCH_FAILED', message: error.message });
    }
});