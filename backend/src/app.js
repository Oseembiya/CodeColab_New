// Server entry point
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { authenticateUser } = require("./middleware/auth");

// Load environment variables
dotenv.config();

// Import route modules
const usersRoutes = require("./routes/users");
const sessionsRoutes = require("./routes/sessions");
const codeExecutionRoutes = require("./routes/codeExecution");
const metricsRoutes = require("./routes/metrics");

// Import socket handlers
const { setupSocketHandlers } = require("./socket/handlers");

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

// Apply CORS globally
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with explicit CORS settings
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  allowEIO3: true,
  transports: ["polling", "websocket"],
});

// Set up socket handlers
setupSocketHandlers(io);

// API routes
app.get("/Api", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "CodeColab API is running",
  });
});

// Debug route to check if server is receiving requests
app.get("/api/debug", authenticateUser, (req, res) => {
  res.json({
    message: "Debug endpoint reached successfully",
    env: {
      RAPIDAPI_KEY_LENGTH: process.env.RAPIDAPI_KEY
        ? process.env.RAPIDAPI_KEY.length
        : 0,
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      JUDGE0_API_URL:
        process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com",
    },
  });
});

// Register route modules
app.use("/api/users", usersRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/code", codeExecutionRoutes);
app.use("/api/metrics", metricsRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date().toISOString(),
  });
});
// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Internal Server Error",
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO server running`);
});

// Handle server shutdown
process.on("SIGINT", () => {
  console.log("Server shutting down");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
