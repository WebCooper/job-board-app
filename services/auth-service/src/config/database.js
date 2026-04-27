const { DataSource } = require('typeorm');
const { User } = require('../entities/User.entity');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '15433', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'auth_db',
  entities: [User],
  synchronize: true,
  logging: false,
  dropSchema: false
});

module.exports = { AppDataSource };
