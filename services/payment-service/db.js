require('reflect-metadata');
const fs = require('fs');
const { DataSource } = require('typeorm');
require('dotenv').config();
const { PaymentEntity } = require('./entities/payment.entity');

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
    entities: [PaymentEntity],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development'
});

const initDB = async () => {
    await appDataSource.initialize();
    console.log("payments_db initialized");
};

const getPaymentRepository = () => appDataSource.getRepository('Payment');

module.exports = { appDataSource, initDB, getPaymentRepository };