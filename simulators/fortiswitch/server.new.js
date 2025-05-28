import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Import configurations and services
import config from './config/config.js';
import logger from './utils/logger.js';
import persistenceService from './services/persistence.service.js';
import authMiddleware from './middleware/auth.middleware.js';
import { initializeSNMPServer } from './services/snmp.service.js';
import { initializeNetflowServer } from './services/netflow.service.js';
import { setupSTP } from './services/stp.service.js';
import { setupTrafficGenerator } from './services/traffic.service.js';

// Import routes
import switchRoutes from './routes/switch.routes.js';
import vlanRoutes from './routes/vlan.routes.js';
import portRoutes from './routes/port.routes.js';
import authRoutes from './routes/auth.routes.js';
import lldpRoutes from './routes/lldp.routes.js';
import stpRoutes from './routes/stp.routes.js';
import monitorRoutes from './routes/monitor.routes.js';

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Socket.IO for real-time updates
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  logger.info('New client connected');
  
  socket.on('subscribe', (data) => {
    if (data.switchId) {
      socket.join(`switch:${data.switchId}`);
      logger.debug(`Client subscribed to switch ${data.switchId}`);
    }
  });
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected');
  });
});

// Apply security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: config.auth.rateLimit.windowMs,
  max: config.auth.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Authentication routes (public)
app.use('/api/auth', authRoutes);

// API Documentation
app.get('/api-docs', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'docs', 'api-docs.html'));
});

// Apply authentication middleware to protected routes
app.use(authMiddleware.requireApiKey);

// API Routes
app.use('/api/switches', switchRoutes);
app.use('/api/vlans', vlanRoutes);
app.use('/api/ports', portRoutes);
app.use('/api/lldp', lldpRoutes);
app.use('/api/stp', stpRoutes);
app.use('/api/monitor', monitorRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', { error: err.stack });
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Initialize services
async function initializeServices() {
  try {
    // Initialize persistence
    await persistenceService.initialize();
    
    // Initialize SNMP server if enabled
    if (config.snmp.enabled) {
      await initializeSNMPServer();
      logger.info(`SNMP server started on port ${config.snmp.port}`);
    }
    
    // Initialize NetFlow server if enabled
    if (config.netflow.enabled) {
      initializeNetflowServer();
      logger.info(`NetFlow server started on port ${config.netflow.port}`);
    }
    
    // Initialize STP if enabled
    if (config.stp.enabled) {
      await setupSTP(io);
      logger.info('Spanning Tree Protocol (STP) initialized');
    }
    
    // Initialize traffic generator if enabled
    if (config.traffic.enabled) {
      setupTrafficGenerator(io);
      logger.info('Traffic generator initialized');
    }
    
    // Start the server
    const PORT = config.server.port;
    httpServer.listen(PORT, config.server.host, () => {
      logger.info(`Server running in ${config.server.environment} mode on port ${PORT}`);
      console.log(`FortiSwitch Simulator running on http://${config.server.host}:${PORT}`);
      console.log(`API Documentation: http://${config.server.host}:${PORT}/api-docs`);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    logger.error('Failed to initialize services', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown function
async function gracefulShutdown() {
  logger.info('Shutting down gracefully...');
  
  try {
    // Close HTTP server
    await new Promise((resolve) => httpServer.close(resolve));
    
    // Close database connections, etc.
    await persistenceService.shutdown();
    
    logger.info('Server has been shut down');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
}

// Start the application
initializeServices().catch(error => {
  logger.error('Fatal error during initialization', { error: error.message });
  process.exit(1);
});

export { app, io };
