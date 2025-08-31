package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	_ "github.com/lib/pq"
	"golang.org/x/net/context"
)

type Task struct {
	ID          int       `json:"id" db:"id"`
	Title       string    `json:"title" db:"title"`
	Description string    `json:"description" db:"description"`
	Status      string    `json:"status" db:"status"`
	Priority    string    `json:"priority" db:"priority"`
	UserID      int       `json:"user_id" db:"user_id"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
	DueDate     *time.Time `json:"due_date" db:"due_date"`
}

type CreateTaskRequest struct {
	Title       string     `json:"title" binding:"required"`
	Description string     `json:"description"`
	Priority    string     `json:"priority"`
	DueDate     *time.Time `json:"due_date"`
}

type UpdateTaskRequest struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	Priority    string     `json:"priority"`
	DueDate     *time.Time `json:"due_date"`
}

var (
	db          *sql.DB
	redisClient *redis.Client
)

func main() {
	// Initialize database
	var err error
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://admin:password123@localhost:5432/taskmanager?sslmode=disable"
	}

	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	// Test database connection
	if err = db.Ping(); err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	// Initialize Redis
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatal("Failed to parse Redis URL:", err)
	}
	redisClient = redis.NewClient(opt)

	// Test Redis connection
	ctx := context.Background()
	_, err = redisClient.Ping(ctx).Result()
	if err != nil {
		log.Fatal("Failed to connect to Redis:", err)
	}

	// Setup Gin
	router := gin.Default()

	// CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
	 "service":   "task-service",
	 "timestamp": time.Now(),
		})
	})

	// Routes
	api := router.Group("/api")
	{
		api.GET("/tasks", getTasks)
		api.POST("/tasks", createTask)
		api.GET("/tasks/:id", getTask)
		api.PUT("/tasks/:id", updateTask)
		api.DELETE("/tasks/:id", deleteTask)
		api.GET("/tasks/user/:userId", getTasksByUser)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}

	log.Printf("Task service starting on port %s", port)
	router.Run(":" + port)
}

func getTasks(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID required"})
		return
	}

	// Check cache first
	ctx := context.Background()
	cacheKey := fmt.Sprintf("tasks:user:%s", userID)
	cached, err := redisClient.Get(ctx, cacheKey).Result()
	if err == nil {
		var tasks []Task
		json.Unmarshal([]byte(cached), &tasks)
		c.JSON(http.StatusOK, tasks)
		return
	}

	// Fetch from database
	rows, err := db.Query(`
	SELECT id, title, description, status, priority, user_id, created_at, updated_at, due_date
	FROM tasks WHERE user_id = $1 ORDER BY created_at DESC
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var task Task
		err := rows.Scan(&task.ID, &task.Title, &task.Description, &task.Status,
				 &task.Priority, &task.UserID, &task.CreatedAt, &task.UpdatedAt, &task.DueDate)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Scan error"})
			return
		}
		tasks = append(tasks, task)
	}

	// Cache the result for 5 minutes
	tasksJSON, _ := json.Marshal(tasks)
	redisClient.Set(ctx, cacheKey, tasksJSON, 5*time.Minute)

	c.JSON(http.StatusOK, tasks)
}

func createTask(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID required"})
		return
	}

	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDInt, _ := strconv.Atoi(userID)

	var taskID int
	err := db.QueryRow(`
	INSERT INTO tasks (title, description, priority, user_id, due_date)
	VALUES ($1, $2, $3, $4, $5) RETURNING id
	`, req.Title, req.Description, req.Priority, userIDInt, req.DueDate).Scan(&taskID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	// Clear cache
	ctx := context.Background()
	cacheKey := fmt.Sprintf("tasks:user:%s", userID)
	redisClient.Del(ctx, cacheKey)

	// Send notification (async)
	go sendTaskNotification(userIDInt, taskID, "created")

	c.JSON(http.StatusCreated, gin.H{"id": taskID, "message": "Task created successfully"})
}

func getTask(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetHeader("X-User-ID")

	var task Task
	err := db.QueryRow(`
	SELECT id, title, description, status, priority, user_id, created_at, updated_at, due_date
	FROM tasks WHERE id = $1 AND user_id = $2
	`, id, userID).Scan(&task.ID, &task.Title, &task.Description, &task.Status,
			    &task.Priority, &task.UserID, &task.CreatedAt, &task.UpdatedAt, &task.DueDate)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, task)
}

func updateTask(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetHeader("X-User-ID")

	var req UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := db.Exec(`
	UPDATE tasks SET title = $1, description = $2, status = $3, priority = $4,
	due_date = $5, updated_at = CURRENT_TIMESTAMP
	WHERE id = $6 AND user_id = $7
	`, req.Title, req.Description, req.Status, req.Priority, req.DueDate, id, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task"})
		return
	}

	// Clear cache
	ctx := context.Background()
	cacheKey := fmt.Sprintf("tasks:user:%s", userID)
	redisClient.Del(ctx, cacheKey)

	c.JSON(http.StatusOK, gin.H{"message": "Task updated successfully"})
}

func deleteTask(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetHeader("X-User-ID")

	result, err := db.Exec("DELETE FROM tasks WHERE id = $1 AND user_id = $2", id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete task"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	// Clear cache
	ctx := context.Background()
	cacheKey := fmt.Sprintf("tasks:user:%s", userID)
	redisClient.Del(ctx, cacheKey)

	c.JSON(http.StatusOK, gin.H{"message": "Task deleted successfully"})
}

func getTasksByUser(c *gin.Context) {
	userID := c.Param("userId")

	rows, err := db.Query(`
	SELECT id, title, description, status, priority, user_id, created_at, updated_at, due_date
	FROM tasks WHERE user_id = $1 ORDER BY created_at DESC
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var task Task
		err := rows.Scan(&task.ID, &task.Title, &task.Description, &task.Status,
				 &task.Priority, &task.UserID, &task.CreatedAt, &task.UpdatedAt, &task.DueDate)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Scan error"})
			return
		}
		tasks = append(tasks, task)
	}

	c.JSON(http.StatusOK, tasks)
}

func sendTaskNotification(userID, taskID int, action string) {
	notificationURL := os.Getenv("NOTIFICATION_SERVICE_URL")
	if notificationURL == "" {
		notificationURL = "http://localhost:6000"
	}

	payload := map[string]interface{}{
		"user_id": userID,
		"task_id": taskID,
		"action":  action,
		"message": fmt.Sprintf("Task %s successfully", action),
	}

	payloadBytes, _ := json.Marshal(payload)

	client := &http.Client{Timeout: 10 * time.Second}
	req, _ := http.NewRequest("POST", notificationURL+"/api/send", nil)
	req.Header.Set("Content-Type", "application/json")

	client.Do(req)
}
