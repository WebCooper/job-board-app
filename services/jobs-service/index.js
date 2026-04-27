const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const { createClient } = require('redis');
const { initDB, getJobRepository } = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

const CACHE_TTL_SECONDS = 300;
const CACHE_KEY_PREFIX = 'jobs:search:';
const vaultRedisSecretPath = '/vault/secrets/redis';
let redisClient = null;

const getRedisUrl = () => {
    if (fs.existsSync(vaultRedisSecretPath)) {
        const redisUrl = fs.readFileSync(vaultRedisSecretPath, 'utf8').trim();
        if (redisUrl) return redisUrl;
    }
    return process.env.REDIS_URL || null;
};

const buildSearchCacheKey = (query) => {
    const queryHash = crypto.createHash('sha256').update(query).digest('hex');
    return `${CACHE_KEY_PREFIX}${queryHash}`;
};

const buildV2SearchCacheKey = (query, page, limit, salaryRange) => {
    const raw = `${query}|${page}|${limit}|${salaryRange?.min || ''}|${salaryRange?.max || ''}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return `${CACHE_KEY_PREFIX}v2:${hash}`;
};

const invalidateSearchCache = async () => {
    if (!redisClient || !redisClient.isOpen) return;
    let cursor = '0';
    do {
        const result = await redisClient.scan(cursor, { MATCH: `${CACHE_KEY_PREFIX}*`, COUNT: 100 });
        cursor = result.cursor;
        if (result.keys.length > 0) {
            await redisClient.del(result.keys);
        }
    } while (cursor !== '0');
};

const connectRedis = async () => {
    const redisUrl = getRedisUrl();
    if (!redisUrl) {
        console.warn('Redis URL not found in Vault secret or REDIS_URL env; caching disabled.');
        return;
    }

    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => {
        console.error('Redis client error:', err.message);
    });
    await redisClient.connect();
    console.log('Redis connected for jobs search caching');
};

const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseSalaryRange = (query) => {
    const range = (query.salary_range || '').toString().trim();
    if (!range) return null;

    const parts = range.split('-').map((part) => part.trim());
    if (parts.length !== 2) return null;

    const min = Number(parts[0]);
    const max = Number(parts[1]);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (min > max) return null;

    return { min, max };
};

// v1: Basic listing for backward compatibility
app.get('/api/v1/jobs', async (_req, res) => {
    try {
        const jobRepository = getJobRepository();
        const jobs = await jobRepository.find({
            where: { status: 'PUBLISHED' },
            order: { created_at: 'DESC' }
        });
        return res.status(200).json(jobs);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// v2: Listing with search query, salary_range filter + pagination metadata + Redis caching
app.get('/api/v2/jobs', async (req, res) => {
    try {
        const page = parsePositiveInt(req.query.page, 1);
        const limit = Math.min(parsePositiveInt(req.query.limit, 10), 100);
        const salaryRange = parseSalaryRange(req.query);
        const query = (req.query.q || '').toString().trim();

        if (req.query.salary_range && !salaryRange) {
            return res.status(400).json({
                error: 'Invalid salary_range. Expected format: min-max (e.g. 50000-120000).'
            });
        }

        const cacheKey = buildV2SearchCacheKey(query.toLowerCase(), page, limit, salaryRange);
        const start = process.hrtime.bigint();

        if (redisClient && redisClient.isOpen) {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
                const cachedData = JSON.parse(cached);
                cachedData.source = 'cache';
                cachedData.duration_ms = Number(durationMs.toFixed(2));
                return res.status(200).json(cachedData);
            }
        }

        const jobRepository = getJobRepository();
        let qb = jobRepository
            .createQueryBuilder('job')
            .where('job.status = :status', { status: 'PUBLISHED' });

        if (query) {
            qb = qb.andWhere('(job.title ILIKE :query OR job.description ILIKE :query)', { query: `%${query}%` });
        }

        if (salaryRange) {
            qb = qb.andWhere(
                'job.salary_min <= :maxSalary AND job.salary_max >= :minSalary',
                { minSalary: salaryRange.min, maxSalary: salaryRange.max }
            );
        }

        const total = await qb.getCount();
        const totalPages = Math.max(Math.ceil(total / limit), 1);
        const offset = (page - 1) * limit;

        const jobs = await qb
            .orderBy('job.created_at', 'DESC')
            .skip(offset)
            .take(limit)
            .getMany();

        const responseData = {
            data: jobs,
            meta: {
                page,
                limit,
                total,
                total_pages: totalPages,
                has_next: page < totalPages,
                has_prev: page > 1
            },
            filters: {
                q: query || null,
                salary_range: salaryRange ? `${salaryRange.min}-${salaryRange.max}` : null
            }
        };

        if (redisClient && redisClient.isOpen) {
            await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: CACHE_TTL_SECONDS });
        }

        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        responseData.source = 'database';
        responseData.duration_ms = Number(durationMs.toFixed(2));

        return res.status(200).json(responseData);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 1. Create Draft Job
app.post('/api/v1/jobs', async (req, res) => {
    const { employer_id, title, description, salary_min, salary_max } = req.body;
    try {
        const jobRepository = getJobRepository();
        const job = jobRepository.create({
            employer_id,
            title,
            description,
            salary_min,
            salary_max,
            status: 'DRAFT'
        });
        const savedJob = await jobRepository.save(job);
        await invalidateSearchCache();
        res.status(201).json(savedJob);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1a. Search Published Jobs (cached in Redis for 5 minutes)
app.get('/api/v1/jobs/search', async (req, res) => {
    const query = (req.query.q || '').toString().trim();
    if (!query) {
        return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const cacheKey = buildSearchCacheKey(query.toLowerCase());
    const start = process.hrtime.bigint();

    try {
        if (redisClient && redisClient.isOpen) {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
                return res.status(200).json({
                    source: 'cache',
                    duration_ms: Number(durationMs.toFixed(2)),
                    data: JSON.parse(cached)
                });
            }
        }

        const jobRepository = getJobRepository();
        const jobs = await jobRepository
            .createQueryBuilder('job')
            .where('job.status = :status', { status: 'PUBLISHED' })
            .andWhere('(job.title ILIKE :query OR job.description ILIKE :query)', { query: `%${query}%` })
            .orderBy('job.created_at', 'DESC')
            .getMany();

        if (redisClient && redisClient.isOpen) {
            await redisClient.set(cacheKey, JSON.stringify(jobs), { EX: CACHE_TTL_SECONDS });
        }

        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        return res.status(200).json({
            source: 'database',
            duration_ms: Number(durationMs.toFixed(2)),
            data: jobs
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 2. Publish Job
app.put('/api/v1/jobs/:id/publish', async (req, res) => {
    try {
        const jobRepository = getJobRepository();
        const existingJob = await jobRepository.findOneBy({ id: req.params.id });
        if (!existingJob) return res.status(404).json({ error: "Job not found" });

        existingJob.status = 'PUBLISHED';
        const updatedJob = await jobRepository.save(existingJob);
        await invalidateSearchCache();
        res.status(200).json(updatedJob);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Delete Job (Saga Rollback)
app.delete('/api/v1/jobs/:id', async (req, res) => {
    try {
        const jobRepository = getJobRepository();
        await jobRepository.delete({ id: req.params.id });
        await invalidateSearchCache();
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Seed endpoint to populate jobs database with sample data
app.post('/api/v1/jobs/seed', async (req, res) => {
    try {
        const jobRepository = getJobRepository();
        
        // Sample jobs data
        const sampleJobs = [
            {
                employer_id: 'employer-1',
                title: 'Senior Full Stack Developer',
                description: 'We are looking for an experienced Full Stack Developer to join our team. You will work on building scalable web applications using Node.js and React.',
                salary_min: 120000,
                salary_max: 150000,
                status: 'PUBLISHED'
            },
            {
                employer_id: 'employer-1',
                title: 'Product Manager',
                description: 'Lead our product strategy and vision. We need someone who can drive product development and work closely with engineering and design teams.',
                salary_min: 110000,
                salary_max: 140000,
                status: 'PUBLISHED'
            },
            {
                employer_id: 'employer-2',
                title: 'DevOps Engineer',
                description: 'Design and maintain our cloud infrastructure using Kubernetes and Docker. Experience with AWS/GCP required.',
                salary_min: 100000,
                salary_max: 135000,
                status: 'PUBLISHED'
            },
            {
                employer_id: 'employer-2',
                title: 'Data Scientist',
                description: 'Join our data team to build ML models and data pipelines. Work with Python, TensorFlow, and big data technologies.',
                salary_min: 115000,
                salary_max: 155000,
                status: 'PUBLISHED'
            },
            {
                employer_id: 'employer-3',
                title: 'Frontend Developer (React)',
                description: 'Build beautiful and responsive user interfaces with React. We use TypeScript, Webpack, and modern web technologies.',
                salary_min: 90000,
                salary_max: 120000,
                status: 'PUBLISHED'
            },
            {
                employer_id: 'employer-3',
                title: 'Backend Developer (Node.js)',
                description: 'Develop robust backend services using Node.js and Express. Experience with microservices and distributed systems preferred.',
                salary_min: 95000,
                salary_max: 125000,
                status: 'PUBLISHED'
            },
            {
                employer_id: 'employer-4',
                title: 'QA Engineer',
                description: 'Ensure quality of our software through automated and manual testing. Experience with Jest, Selenium, and CI/CD pipelines required.',
                salary_min: 75000,
                salary_max: 100000,
                status: 'PUBLISHED'
            },
            {
                employer_id: 'employer-4',
                title: 'Solutions Architect',
                description: 'Design scalable cloud solutions for our enterprise clients. AWS/Azure certifications are a plus.',
                salary_min: 130000,
                salary_max: 170000,
                status: 'PUBLISHED'
            },
            {
                employer_id: 'employer-5',
                title: 'Mobile Developer (iOS)',
                description: 'Develop native iOS applications using Swift. Experience with SwiftUI and Combine framework required.',
                salary_min: 100000,
                salary_max: 130000,
                status: 'PUBLISHED'
            },
            {
                employer_id: 'employer-5',
                title: 'UX/UI Designer',
                description: 'Create intuitive and beautiful user experiences. Proficiency with Figma, Adobe XD required.',
                salary_min: 85000,
                salary_max: 115000,
                status: 'PUBLISHED'
            }
        ];

        // Check if jobs already exist
        const existingCount = await jobRepository.count();
        if (existingCount > 0) {
            return res.status(400).json({ 
                error: 'Jobs database already seeded', 
                existingCount 
            });
        }

        // Create and save all jobs
        const createdJobs = [];
        for (const jobData of sampleJobs) {
            const job = jobRepository.create(jobData);
            const savedJob = await jobRepository.save(job);
            createdJobs.push(savedJob);
        }

        await invalidateSearchCache();
        return res.status(201).json({
            message: `Successfully seeded ${createdJobs.length} jobs`,
            jobs: createdJobs
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});


// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok", service: "jobs-service" });
});


const PORT = process.env.PORT || 3002;
initDB().then(async () => {
    await connectRedis();
    app.listen(PORT, () => console.log(`Jobs Service running on port ${PORT}`));
}).catch((error) => {
    console.error('Failed to initialize jobs-service database:', error.message);
    process.exit(1);
});