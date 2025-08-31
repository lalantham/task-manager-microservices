const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const redis = require('redis');
const { Queue, Worker } = require('bullmq');

const app = express();
const PORT = process.env.PORT || 6000;

// Redis connection
const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
};

// Create notification queue
const notificationQueue = new Queue('notifications', {
    connection: redisConnection,
});

// Email transporter
const transporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || 'test@example.com',
        pass: process.env.EMAIL_PASS || 'test-password'
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'notification-service',
        timestamp: new Date().toISOString()
    });
});

// Send notification endpoint
app.post('/api/send', async (req, res) => {
    try {
        const { user_id, task_id, action, message, email } = req.body;

        // Add job to queue
        await notificationQueue.add('send-notification', {
            user_id,
            task_id,
            action,
            message,
            email,
            timestamp: new Date().toISOString()
        });

        res.status(200).json({ message: 'Notification queued successfully' });
    } catch (error) {
        console.error('Error queueing notification:', error);
        res.status(500).json({ error: 'Failed to queue notification' });
    }
});

// Get notification history
app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const redisClient = redis.createClient({ url: process.env.REDIS_URL });
        await redisClient.connect();

        const notifications = await redisClient.lRange(`notifications:${userId}`, 0, -1);
        const parsedNotifications = notifications.map(n => JSON.parse(n));

        await redisClient.disconnect();
        res.json(parsedNotifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Process notification queue
const worker = new Worker('notifications', async (job) => {
    const { user_id, task_id, action, message, email } = job.data;

    try {
        // Store notification in Redis
        const redisClient = redis.createClient({ url: process.env.REDIS_URL });
        await redisClient.connect();

        const notification = {
            id: Date.now(),
                          user_id,
                          task_id,
                          action,
                          message,
                          timestamp: new Date().toISOString(),
                          read: false
        };

        await redisClient.lPush(`notifications:${user_id}`, JSON.stringify(notification));
        await redisClient.lTrim(`notifications:${user_id}`, 0, 99); // Keep last 100

        // Send email if email provided
        if (email && process.env.EMAIL_USER !== 'test@example.com') {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: `Task ${action}`,
                html: `
                <h3>Task Update</h3>
                <p>${message}</p>
                <p>Task ID: ${task_id}</p>
                <p>Time: ${new Date().toLocaleString()}</p>
                `
            });
            console.log(`Email sent to ${email} for task ${task_id}`);
        }

        await redisClient.disconnect();
        console.log(`Notification processed for user ${user_id}, task ${task_id}`);
    } catch (error) {
        console.error('Error processing notification:', error);
        throw error;
    }
}, {
    connection: redisConnection,
});

// Mark notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        const redisClient = redis.createClient({ url: process.env.REDIS_URL });
        await redisClient.connect();

        const notifications = await redisClient.lRange(`notifications:${userId}`, 0, -1);
        const updatedNotifications = notifications.map(n => {
            const notification = JSON.parse(n);
            if (notification.id === parseInt(id)) {
                notification.read = true;
            }
            return JSON.stringify(notification);
        });

        await redisClient.del(`notifications:${userId}`);
        for (const notification of updatedNotifications.reverse()) {
            await redisClient.lPush(`notifications:${userId}`, notification);
        }

        await redisClient.disconnect();
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

app.listen(PORT, () => {
    console.log(`Notification service running on port ${PORT}`);
});
