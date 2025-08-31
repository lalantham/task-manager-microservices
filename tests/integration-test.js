// Integration Tests for Task Manager Microservices
const axios = require('axios');
const { expect } = require('chai');

const API_BASE = process.env.API_URL || 'http://localhost:3000';

describe('Task Manager Integration Tests', () => {
    let authToken;
    let userId;
    let taskId;

    before(async () => {
        // Wait for services to be ready
        await new Promise(resolve => setTimeout(resolve, 5000));
    });

    describe('Health Checks', () => {
        it('should check API Gateway health', async () => {
            const response = await axios.get(`${API_BASE}/health`);
            expect(response.status).to.equal(200);
            expect(response.data.status).to.equal('healthy');
        });
    });

    describe('User Authentication', () => {
        const testUser = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123'
        };

        it('should register a new user', async () => {
            const response = await axios.post(`${API_BASE}/api/users/register`, testUser);
            expect(response.status).to.equal(200);
            expect(response.data.access_token).to.exist;
            authToken = response.data.access_token;
        });

        it('should login with correct credentials', async () => {
            const response = await axios.post(`${API_BASE}/api/users/login`, {
                email: testUser.email,
                password: testUser.password
            });
            expect(response.status).to.equal(200);
            expect(response.data.access_token).to.exist;
            authToken = response.data.access_token;
        });

        it('should get user profile with valid token', async () => {
            const response = await axios.get(`${API_BASE}/api/users/profile`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            expect(response.status).to.equal(200);
            expect(response.data.username).to.equal(testUser.username);
            userId = response.data.id;
        });

        it('should reject invalid token', async () => {
            try {
                await axios.get(`${API_BASE}/api/users/profile`, {
                    headers: { Authorization: 'Bearer invalid-token' }
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.response.status).to.equal(403);
            }
        });
    });

    describe('Task Management', () => {
        const testTask = {
            title: 'Integration Test Task',
            description: 'This is a test task for integration testing',
            priority: 'high',
            due_date: new Date(Date.now() + 86400000).toISOString() // Tomorrow
        };

        it('should create a new task', async () => {
            const response = await axios.post(`${API_BASE}/api/tasks`, testTask, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            expect(response.status).to.equal(201);
            expect(response.data.id).to.exist;
            taskId = response.data.id;
        });

        it('should get all tasks for user', async () => {
            const response = await axios.get(`${API_BASE}/api/tasks`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            expect(response.status).to.equal(200);
            expect(response.data).to.be.an('array');
            expect(response.data.length).to.be.greaterThan(0);
        });

        it('should get specific task', async () => {
            const response = await axios.get(`${API_BASE}/api/tasks/${taskId}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            expect(response.status).to.equal(200);
            expect(response.data.title).to.equal(testTask.title);
        });

        it('should update task status', async () => {
            const response = await axios.put(`${API_BASE}/api/tasks/${taskId}`, {
                status: 'in_progress'
            }, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            expect(response.status).to.equal(200);
        });

        it('should delete task', async () => {
            const response = await axios.delete(`${API_BASE}/api/tasks/${taskId}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            expect(response.status).to.equal(200);
        });
    });

    describe('Notification Service', () => {
        it('should get notifications for user', async () => {
            const response = await axios.get(`${API_BASE}/api/notifications/${userId}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            expect(response.status).to.equal(200);
            expect(response.data).to.be.an('array');
        });
    });

    describe('Error Handling', () => {
        it('should handle non-existent routes', async () => {
            try {
                await axios.get(`${API_BASE}/api/nonexistent`);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.response.status).to.equal(404);
            }
        });

        it('should handle unauthorized requests', async () => {
            try {
                await axios.get(`${API_BASE}/api/tasks`);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.response.status).to.equal(401);
            }
        });
    });

    describe('Performance Tests', () => {
        it('should handle concurrent requests', async () => {
            const requests = [];
            for (let i = 0; i < 10; i++) {
                requests.push(
                    axios.get(`${API_BASE}/health`)
                );
            }

            const responses = await Promise.all(requests);
            responses.forEach(response => {
                expect(response.status).to.equal(200);
            });
        });

        it('should respond within acceptable time', async () => {
            const start = Date.now();
            await axios.get(`${API_BASE}/health`);
            const duration = Date.now() - start;
            expect(duration).to.be.lessThan(1000); // Less than 1 second
        });
    });
});

// Load testing helper
const loadTest = async (concurrency = 10, duration = 30) => {
    console.log(`Starting load test: ${concurrency} concurrent users for ${duration}s`);

    const startTime = Date.now();
    let requestCount = 0;
    let errorCount = 0;

    const makeRequest = async () => {
        while (Date.now() - startTime < duration * 1000) {
            try {
                await axios.get(`${API_BASE}/health`);
                requestCount++;
            } catch (error) {
                errorCount++;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    };

    const workers = Array(concurrency).fill().map(() => makeRequest());
    await Promise.all(workers);

    console.log(`Load test completed:`);
    console.log(`- Total requests: ${requestCount}`);
    console.log(`- Errors: ${errorCount}`);
    console.log(`- Success rate: ${((requestCount - errorCount) / requestCount * 100).toFixed(2)}%`);
    console.log(`- Requests/second: ${(requestCount / duration).toFixed(2)}`);
};

module.exports = { loadTest };
