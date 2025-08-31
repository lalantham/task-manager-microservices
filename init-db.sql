-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(10) DEFAULT 'medium',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Insert sample data
INSERT INTO users (username, email, password_hash) VALUES
('john_doe', 'john@example.com', '$2b$10$rOzJmZl0mSCYo6rXx6Z1h.3X4DQgIJ4LQ7K8Z1QFj2HjPz5w4Z9E6'),
('jane_smith', 'jane@example.com', '$2b$10$rOzJmZl0mSCYo6rXx6Z1h.3X4DQgIJ4LQ7K8Z1QFj2HjPz5w4Z9E6')
ON CONFLICT (email) DO NOTHING;

INSERT INTO tasks (title, description, status, priority, user_id) VALUES
('Setup Development Environment', 'Install Docker, Kubernetes, and other tools', 'in_progress', 'high', 1),
('Learn Microservices', 'Study microservice architecture patterns', 'pending', 'medium', 1),
('Deploy to Cloud', 'Deploy the application to OCI/Azure', 'pending', 'low', 2)
ON CONFLICT DO NOTHING;
