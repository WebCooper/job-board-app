require('reflect-metadata');
const { DataSource } = require('typeorm');
require('dotenv').config();
const { ApplicationEntity } = require('./entities/application.entity');

const appDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [ApplicationEntity],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development'
});

const initDB = async () => {
    await appDataSource.initialize();
    console.log("applications_db is initialized");
};

const getApplicationRepository = () => appDataSource.getRepository('Application');

module.exports = { appDataSource, initDB, getApplicationRepository };