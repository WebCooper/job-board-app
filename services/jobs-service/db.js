require('reflect-metadata');
const fs = require('fs');
const { DataSource } = require('typeorm');
require('dotenv').config();
const { JobEntity } = require('./entities/job.entity');

const vaultSecretPath = '/vault/secrets/database';
const getDatabaseUrl = () => {
    if (!fs.existsSync(vaultSecretPath)) {
        throw new Error(`Vault-injected database secret not found at ${vaultSecretPath}`);
    }

    const databaseUrl = fs.readFileSync(vaultSecretPath, 'utf8').trim();
    if (!databaseUrl) {
        throw new Error(`Vault-injected database secret is empty at ${vaultSecretPath}`);
    }

    return databaseUrl;
};

const appDataSource = new DataSource({
    type: 'postgres',
    url: getDatabaseUrl(),
    entities: [JobEntity],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development'
});

const initDB = async () => {
    await appDataSource.initialize();
    console.log("jobs_db initialized");
};

const getJobRepository = () => appDataSource.getRepository('Job');

module.exports = { appDataSource, initDB, getJobRepository };