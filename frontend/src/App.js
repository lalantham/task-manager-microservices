import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function App() {
    const [user, setUser] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('tasks');

    // Auth forms
    const [loginForm, setLoginForm] = useState({ email: '', password: '' });
    const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' });
    const [showRegister, setShowRegister] = useState(false);

    // Task form
    const [taskForm, setTaskForm] = useState({
        title: '',
        description: '',
        priority: 'medium',
        due_date: ''
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            loadUserProfile();
            loadTasks();
            loadNotifications();
        }
    }, []);

    const loadUserProfile = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/users/profile`);
            setUser(response.data);
        } catch (error) {
            console.error('Failed to load profile:', error);
            logout();
        }
    };

    const loadTasks = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/tasks`);
            setTasks(response.data);
        } catch (error) {
            console.error('Failed to load tasks:', error);
        }
    };

    const loadNotifications = async () => {
        try {
            if (user) {
                const response = await axios.get(`${API_URL}/api/notifications/${user.id}`);
                setNotifications(response.data);
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    };

    const login = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/api/users/login`, loginForm);
            const token = response.data.access_token;
            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            await loadUserProfile();
            await loadTasks();
            setLoginForm({ email: '', password: '' });
        } catch (error) {
            alert('Login failed: ' + (error.response?.data?.detail || 'Unknown error'));
        }
        setLoading(false);
    };

    const register = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await axios.post(`${API_URL}/api/users/register`, registerForm);
            const token = response.data.access_token;
            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            await loadUserProfile();
            setRegisterForm({ username: '', email: '', password: '' });
            setShowRegister(false);
        } catch (error) {
            alert('Registration failed: ' + (error.response?.data?.detail || 'Unknown error'));
        }
        setLoading(false);
    };

    const logout = () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        setTasks([]);
        setNotifications([]);
    };

    const createTask = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post(`${API_URL}/api/tasks`, taskForm);
            setTaskForm({ title: '', description: '', priority: 'medium', due_date: '' });
            await loadTasks();
        } catch (error) {
            alert('Failed to create task: ' + (error.response?.data?.error || 'Unknown error'));
        }
        setLoading(false);
    };

    const updateTaskStatus = async (taskId, newStatus) => {
        try {
            await axios.put(`${API_URL}/api/tasks/${taskId}`, { status: newStatus });
            await loadTasks();
        } catch (error) {
            alert('Failed to update task: ' + (error.response?.data?.error || 'Unknown error'));
        }
    };

    const deleteTask = async (taskId) => {
        if (window.confirm('Are you sure you want to delete this task?')) {
            try {
                await axios.delete(`${API_URL}/api/tasks/${taskId}`);
                await loadTasks();
            } catch (error) {
                alert('Failed to delete task: ' + (error.response?.data?.error || 'Unknown error'));
            }
        }
    };

    if (!user) {
        return (
            <div className="auth-container">
            <div className="auth-form">
            <h1>Task Manager</h1>
            {!showRegister ? (
                <form onSubmit={login}>
                <h2>Login</h2>
                <input
                type="email"
                placeholder="Email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                required
                />
                <input
                type="password"
                placeholder="Password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                required
                />
                <button type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
                </button>
                <p>
                Don't have an account?
                <button type="button" onClick={() => setShowRegister(true)}>
                Register
                </button>
                </p>
                </form>
            ) : (
                <form onSubmit={register}>
                <h2>Register</h2>
                <input
                type="text"
                placeholder="Username"
                value={registerForm.username}
                onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                required
                />
                <input
                type="email"
                placeholder="Email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                required
                />
                <input
                type="password"
                placeholder="Password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                required
                />
                <button type="submit" disabled={loading}>
                {loading ? 'Registering...' : 'Register'}
                </button>
                <p>
                Already have an account?
                <button type="button" onClick={() => setShowRegister(false)}>
                Login
                </button>
                </p>
                </form>
            )}
            </div>
            </div>
        );
    }

    return (
        <div className="app">
        <header className="header">
        <h1>Task Manager</h1>
        <div className="header-actions">
        <span>Welcome, {user.username}!</span>
        <button onClick={logout}>Logout</button>
        </div>
        </header>

        <nav className="nav-tabs">
        <button
        className={activeTab === 'tasks' ? 'active' : ''}
        onClick={() => setActiveTab('tasks')}
        >
        Tasks ({tasks.length})
        </button>
        <button
        className={activeTab === 'notifications' ? 'active' : ''}
        onClick={() => setActiveTab('notifications')}
        >
        Notifications ({notifications.filter(n => !n.read).length})
        </button>
        </nav>

        {activeTab === 'tasks' && (
            <div className="tasks-section">
            <div className="task-form">
            <h3>Create New Task</h3>
            <form onSubmit={createTask}>
            <input
            type="text"
            placeholder="Task title"
            value={taskForm.title}
            onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
            required
            />
            <textarea
            placeholder="Task description"
            value={taskForm.description}
            onChange={(e) => setTaskForm({...taskForm, description: e.target.value})}
            />
            <select
            value={taskForm.priority}
            onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})}
            >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
            </select>
            <input
            type="datetime-local"
            value={taskForm.due_date}
            onChange={(e) => setTaskForm({...taskForm, due_date: e.target.value})}
            />
            <button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Task'}
            </button>
            </form>
            </div>

            <div className="tasks-list">
            <h3>Your Tasks</h3>
            {tasks.length === 0 ? (
                <p>No tasks yet. Create your first task above!</p>
            ) : (
                tasks.map(task => (
                    <div key={task.id} className={`task-card priority-${task.priority}`}>
                    <div className="task-header">
                    <h4>{task.title}</h4>
                    <span className={`status status-${task.status}`}>
                    {task.status.replace('_', ' ')}
                    </span>
                    </div>
                    <p>{task.description}</p>
                    {task.due_date && (
                        <p className="due-date">
                        Due: {new Date(task.due_date).toLocaleDateString()}
                        </p>
                    )}
                    <div className="task-actions">
                    <select
                    value={task.status}
                    onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                    >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    </select>
                    <button
                    className="delete-btn"
                    onClick={() => deleteTask(task.id)}
                    >
                    Delete
                    </button>
                    </div>
                    </div>
                ))
            )}
            </div>
            </div>
        )}

        {activeTab === 'notifications' && (
            <div className="notifications-section">
            <h3>Notifications</h3>
            {notifications.length === 0 ? (
                <p>No notifications yet.</p>
            ) : (
                notifications.map(notification => (
                    <div
                    key={notification.id}
                    className={`notification ${notification.read ? 'read' : 'unread'}`}
                    >
                    <p>{notification.message}</p>
                    <small>{new Date(notification.timestamp).toLocaleString()}</small>
                    </div>
                ))
            )}
            </div>
        )}
        </div>
    );
}

export default App;
