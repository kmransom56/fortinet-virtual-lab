/**
 * FortiSwitch API Simulator
 * 
 * This server simulates the API of FortiSwitch devices for the Fortinet Virtual Lab.
 * It provides realistic API responses for FortiSwitch management operations.
 */

// Load environment variables
require('dotenv').config();

// Import dependencies
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const winston = require('winston');

// Create Express app
const app = express();
const port = process.env.PORT || 3001;

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/fortiswitch-simulator.log' })
  ],
});

// Ensure logs directory exists
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Ensure data directory exists
if (!fs.existsSync('data')) {
  fs.mkdirSync('data');
}

// FortiSwitch simulation state
let switchState = {
  hostname: 'FS-S124E-SONIC',
  serial: 'S124ENTF3X00001',
  firmware: 'FortiSwitchOS 6.4.6',
  model: 'FortiSwitch-124E',
  uptime: 1234567,
  cpu: 12,
  memory: 35,
  interfaces: [
    { name: 'port1', status: 'up', speed: '1000', duplex: 'full', type: 'GE', vlan: 1 },
    { name: 'port2', status: 'up', speed: '1000', duplex: 'full', type: 'GE', vlan: 1 },
    { name: 'port3', status: 'down', speed: '0', duplex: 'none', type: 'GE', vlan: 1 },
    { name: 'port4', status: 'up', speed: '1000', duplex: 'full', type: 'GE', vlan: 10 },
    { name: 'port5', status: 'up', speed: '1000', duplex: 'full', type: 'GE', vlan: 10 },
    { name: 'port6', status: 'up', speed: '1000', duplex: 'full', type: 'GE', vlan: 20 },
    { name: 'port7', status: 'up', speed: '1000', duplex: 'full', type: 'GE', vlan: 20 },
    { name: 'port8', status: 'up', speed: '1000', duplex: 'full', type: 'GE', vlan: 20 },
  ],
  vlans: [
    { id: 1, name: 'default', interfaces: ['port1', 'port2', 'port3'] },
    { id: 10, name: 'data', interfaces: ['port4', 'port5'] },
    { id: 20, name: 'voice', interfaces: ['port6', 'port7', 'port8'] },
  ],
  fortilink: {
    status: 'up',
    fortigate: 'FG-S100-SONIC',
    interface: 'port1',
    serial: 'FGT60ETK123456789'
  }
};

// Load initial state from file if it exists
const stateFile = path.join('data', 'switch-state.json');
if (fs.existsSync(stateFile)) {
  try {
    const savedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    switchState = savedState;
    logger.info('Loaded FortiSwitch state from file');
  } catch (error) {
    logger.error('Failed to load FortiSwitch state from file', { error: error.message });
  }
}

// Save state periodically
setInterval(() => {
  try {
    fs.writeFileSync(stateFile, JSON.stringify(switchState, null, 2));
    logger.debug('Saved FortiSwitch state to file');
  } catch (error) {
    logger.error('Failed to save FortiSwitch state to file', { error: error.message });
  }
}, 60000); // Save every minute

// Middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// API authentication
const JWT_SECRET = process.env.JWT_SECRET || 'fortiswitch-simulator-secret';
const authenticate = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API routes

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // In a real system, validate credentials against a database
  // For the simulator, we'll accept admin/admin or specific credentials
  if ((username === 'admin' && password === 'admin') || 
      (username === 'fortinet' && password === 'fortinet123')) {
    
    // Generate JWT token
    const token = jwt.sign(
      { username, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    return res.json({
      success: true,
      token,
      user: { username, role: 'admin' }
    });
  }
  
  return res.status(401).json({
    success: false,
    error: 'Invalid credentials'
  });
});

// System information
app.get('/api/system/status', authenticate, (req, res) => {
  res.json({
    hostname: switchState.hostname,
    serial: switchState.serial,
    firmware: switchState.firmware,
    model: switchState.model,
    uptime: switchState.uptime + Math.floor((Date.now() / 1000) % 86400), // Simulate increasing uptime
    cpu_usage: switchState.cpu,
    memory_usage: switchState.memory,
    status: 'active'
  });
});

// Interface information
app.get('/api/interfaces', authenticate, (req, res) => {
  res.json({
    interfaces: switchState.interfaces
  });
});

// Get specific interface
app.get('/api/interfaces/:name', authenticate, (req, res) => {
  const interfaceName = req.params.name;
  const interfaceInfo = switchState.interfaces.find(i => i.name === interfaceName);
  
  if (!interfaceInfo) {
    return res.status(404).json({ error: 'Interface not found' });
  }
  
  res.json(interfaceInfo);
});

// Update interface
app.put('/api/interfaces/:name', authenticate, (req, res) => {
  const interfaceName = req.params.name;
  const interfaceIndex = switchState.interfaces.findIndex(i => i.name === interfaceName);
  
  if (interfaceIndex === -1) {
    return res.status(404).json({ error: 'Interface not found' });
  }
  
  // Update allowed fields
  const { status, vlan } = req.body;
  
  if (status) {
    switchState.interfaces[interfaceIndex].status = status;
    // If status changes to down, update speed and duplex accordingly
    if (status === 'down') {
      switchState.interfaces[interfaceIndex].speed = '0';
      switchState.interfaces[interfaceIndex].duplex = 'none';
    } else if (status === 'up') {
      switchState.interfaces[interfaceIndex].speed = '1000';
      switchState.interfaces[interfaceIndex].duplex = 'full';
    }
  }
  
  if (vlan) {
    // Check if VLAN exists
    const vlanExists = switchState.vlans.some(v => v.id === parseInt(vlan));
    if (!vlanExists) {
      return res.status(400).json({ error: 'VLAN does not exist' });
    }
    
    // Update VLAN assignment
    switchState.interfaces[interfaceIndex].vlan = parseInt(vlan);
    
    // Update VLAN interface lists
    switchState.vlans.forEach(v => {
      // Remove interface from current VLAN
      v.interfaces = v.interfaces.filter(i => i !== interfaceName);
      
      // Add interface to new VLAN
      if (v.id === parseInt(vlan)) {
        v.interfaces.push(interfaceName);
      }
    });
  }
  
  res.json({
    success: true,
    interface: switchState.interfaces[interfaceIndex]
  });
});

// Get VLANs
app.get('/api/vlans', authenticate, (req, res) => {
  res.json({
    vlans: switchState.vlans
  });
});

// Create VLAN
app.post('/api/vlans', authenticate, (req, res) => {
  const { id, name } = req.body;
  
  // Validate required fields
  if (!id || !name) {
    return res.status(400).json({ error: 'VLAN ID and name are required' });
  }
  
  // Check if VLAN already exists
  const vlanExists = switchState.vlans.some(v => v.id === parseInt(id));
  if (vlanExists) {
    return res.status(400).json({ error: 'VLAN already exists' });
  }
  
  // Add new VLAN
  const newVlan = {
    id: parseInt(id),
    name: name,
    interfaces: []
  };
  
  switchState.vlans.push(newVlan);
  
  res.status(201).json({
    success: true,
    vlan: newVlan
  });
});

// Get FortiLink status
app.get('/api/fortilink', authenticate, (req, res) => {
  res.json(switchState.fortilink);
});

// Health check endpoint (no authentication required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Start server
app.listen(port, () => {
  logger.info(`FortiSwitch Simulator running on port ${port}`);
});

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Shutting down FortiSwitch Simulator');
  // Save state before exit
  try {
    fs.writeFileSync(stateFile, JSON.stringify(switchState, null, 2));
    logger.info('Saved FortiSwitch state before shutdown');
  } catch (error) {
    logger.error('Failed to save FortiSwitch state before shutdown', { error: error.message });
  }
  process.exit(0);
});

module.exports = app; // Export for testing