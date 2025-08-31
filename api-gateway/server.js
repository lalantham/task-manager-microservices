const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Redis client for caching
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Service URLs
const services = {
    user: process.env.USER_SERVICE_URL || 'http://localhost:4000',
    task: process.env.TASK_SERVICE_URL || 'http://localhost:5000',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:6000'
};

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
                         services: services
    });
});

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        // Check cache first
        const cachedUser = await redisClient.get(`auth:${token}`);
        if (cachedUser) {
            req.user = JSON.parse(cachedUser);
            return next();
        }

        // Validate token with user service
        const response = await fetch(`${services.user}/api/auth/validate`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            return res.status(403).json({ error: 'Invalid token' });
        }

        const user = await response.json();
        // Cache for 5 minutes
        await redisClient.setEx(`auth:${token}`, 300, JSON.stringify(user));
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication service error' });
    }
};

// Proxy configurations
const userServiceProxy = createProxyMiddleware({
    target: services.user,
    changeOrigin: true,
    pathRewrite: {
        '^/api/users': '/api'
    },
    onError: (err, req, res) => {
        console.error('User service proxy error:', err);
        res.status(503).json({ error: 'User service unavailable' });
    }
});

const taskServiceProxy = createProxyMiddleware({
    target: services.task,
    changeOrigin: true,
    pathRewrite: {
        '^/api/tasks': '/api'
    },
    onError: (err, req, res) => {
        console.error('Task service proxy error:', err);
        res.status(503).json({ error: 'Task service unavailable' });
    }
});

const notificationServiceProxy = createProxyMiddleware({
    target: services.notification,
    changeOrigin: true,
    pathRewrite: {
        '^/api/notifications': '/api'
    },
    onError: (err, req, res) => {
        console.error('Notification service proxy error:', err);
        res.status(503).json({ error: 'Notification service unavailable' });
    }
});

// Routes
// Public routes (no auth required)
app.use('/api/users/register', userServiceProxy);
app.use('/api/users/login', userServiceProxy);

// Protected routes (auth required)
app.use('/api/users', authenticateToken, userServiceProxy);
app.use('/api/tasks', authenticateToken, taskServiceProxy);
app.use('/api/notifications', authenticateToken, notificationServiceProxy);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Gateway error:', err);
    res.status(500).json({ error: 'Internal gateway error' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
    console.log('Service URLs:', services);
});
