require('reflect-metadata');
const express = require('express');
const cors = require('cors');
const { auth } = require('express-oauth2-jwt-bearer');
const { AppDataSource } = require('./src/config/database');
const { User } = require('./src/entities/User.entity');

const app = express();
app.use(express.json());
app.use(cors());

// 2. Auth0 JWT Validation Middleware
const checkJwt = auth({
  audience: 'https://jobboard-api',
  issuerBaseURL: 'https://dev-tcizcdzuftlsdihd.ca.auth0.com/',
  tokenSigningAlg: 'RS256'
});

// 3. Custom Middleware to Extract Data from the Validated Token
const extractUserIdentity = (req, res, next) => {
  const namespace = 'https://jobboard-api/roles';
  
  req.user = {
    sub: req.auth.payload.sub,
    roles: req.auth.payload[namespace] || ['candidate']
  };
  
  next();
};

// Initialize database and start server
AppDataSource.initialize()
  .then(async () => {
    console.log('✓ Database connected and schema synchronized');

    // 4. Endpoints

    // Synchronize Auth0 login with local database
    app.post('/api/v1/auth/profile', checkJwt, extractUserIdentity, async (req, res) => {
      try {
        const { sub, roles } = req.user;
        const primaryRole = roles[0];

        const userRepository = AppDataSource.getRepository(User);
        let user = await userRepository.findOne({ where: { auth0_sub: sub } });

        if (!user) {
          user = userRepository.create({
            auth0_sub: sub,
            role: primaryRole
          });
          await userRepository.save(user);
          console.log(`New user registered: ${sub} as ${primaryRole}`);
        } else {
          console.log(`Existing user logged in: ${sub}`);
        }

        const { created_at, ...userWithoutCreatedAt } = user;
        res.status(200).json({
          ...userWithoutCreatedAt,
          created_at
        });
      } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Fetch a user profile by their local database ID
    app.get('/api/v1/auth/users/:id', checkJwt, async (req, res) => {
      try {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { id: parseInt(req.params.id) } });

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
      } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'Auth Service is running' });
    });

    // 5. Start Server
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Auth Service running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });