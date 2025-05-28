const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
require('dotenv').config();

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'fortiswitch-simulator' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Ensure logs directory exists
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Load configuration
const deviceCount = process.env.DEVICE_COUNT || 5;
const brand = process.env.BRAND || 'sonic';
let configData = {};

// Create Express app
const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Try to load config files if they exist
try {
  const configPath = path.join(__dirname, 'configs', `${brand}_fortiswitch_config.json`);
  if (fs.existsSync(configPath)) {
    configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    logger.info(`Loaded configuration from ${configPath}`);
  } else {
    logger.info(`No configuration file found at ${configPath}, using default values`);
  }
} catch (error) {
  logger.error(`Error loading configuration: ${error.message}`);
}

// Generate switch data
const switches = [];
for (let i = 1; i <= deviceCount; i++) {
  switches.push({
    id: `SW${i.toString().padStart(3, '0')}`,
    name: `${brand.toUpperCase()}-SW-${i}`,
    model: 'FortiSwitch-448D-FPOE',
    serialNumber: `FSW${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    firmwareVersion: '7.0.2',
    managementIp: `10.3.2.${i + 10}`,
    status: 'online',
    ports: generatePorts(),
    vlans: generateVlans(),
    stats: {
      cpuUsage: Math.floor(Math.random() * 30),
      memoryUsage: Math.floor(Math.random() * 50),
      uptimeSeconds: Math.floor(Math.random() * 2592000) // Up to 30 days
    },
    ...configData
  });
}

// Helper functions to generate realistic switch data
function generatePorts() {
  const ports = [];
  const portCount = 48; // 48-port switch
  
  for (let i = 1; i <= portCount; i++) {
    const isUplink = i > 44;
    const speed = isUplink ? '10G' : '1G';
    
    ports.push({
      id: i,
      name: `port${i}`,
      type: isUplink ? 'SFP+' : 'RJ45',
      speed: speed,
      status: Math.random() > 0.2 ? 'up' : 'down',
      vlan: Math.floor(Math.random() * 5) + 1,
      poe: !isUplink && Math.random() > 0.3,
      macAddresses: [
        generateRandomMac(),
        Math.random() > 0.7 ? generateRandomMac() : null
      ].filter(Boolean)
    });
  }
  
  return ports;
}

function generateVlans() {
  const vlans = [
    { id: 1, name: 'default', interfaces: [] },
    { id: 10, name: 'data', interfaces: [] },
    { id: 20, name: 'voice', interfaces: [] },
    { id: 30, name: 'management', interfaces: [] },
    { id: 40, name: 'guest', interfaces: [] }
  ];
  
  return vlans;
}

function generateRandomMac() {
  return Array(6).fill(0).map(() => {
    return Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }).join(':');
}

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Get all switches
app.get('/api/switches', (req, res) => {
  logger.info('GET /api/switches');
  res.json(switches);
});

// Get specific switch
app.get('/api/switches/:id', (req, res) => {
  const switchId = req.params.id;
  logger.info(`GET /api/switches/${switchId}`);
  
  const switchData = switches.find(s => s.id === switchId);
  if (!switchData) {
    logger.error(`Switch with ID ${switchId} not found`);
    return res.status(404).json({ error: 'Switch not found' });
  }
  
  res.json(switchData);
});

// Get switch ports
app.get('/api/switches/:id/ports', (req, res) => {
  const switchId = req.params.id;
  logger.info(`GET /api/switches/${switchId}/ports`);
  
  const switchData = switches.find(s => s.id === switchId);
  if (!switchData) {
    logger.error(`Switch with ID ${switchId} not found`);
    return res.status(404).json({ error: 'Switch not found' });
  }
  
  res.json(switchData.ports);
});

// Get switch VLANs
app.get('/api/switches/:id/vlans', (req, res) => {
  const switchId = req.params.id;
  logger.info(`GET /api/switches/${switchId}/vlans`);
  
  const switchData = switches.find(s => s.id === switchId);
  if (!switchData) {
    logger.error(`Switch with ID ${switchId} not found`);
    return res.status(404).json({ error: 'Switch not found' });
  }
  
  res.json(switchData.vlans);
});

// Update switch port status
app.put('/api/switches/:id/ports/:portId', (req, res) => {
  const switchId = req.params.id;
  const portId = parseInt(req.params.portId);
  logger.info(`PUT /api/switches/${switchId}/ports/${portId}`);
  
  const switchData = switches.find(s => s.id === switchId);
  if (!switchData) {
    logger.error(`Switch with ID ${switchId} not found`);
    return res.status(404).json({ error: 'Switch not found' });
  }
  
  const port = switchData.ports.find(p => p.id === portId);
  if (!port) {
    logger.error(`Port with ID ${portId} not found on switch ${switchId}`);
    return res.status(404).json({ error: 'Port not found' });
  }
  
  // Update port properties
  Object.assign(port, req.body);
  logger.info(`Updated port ${portId} on switch ${switchId}`);
  
  res.json(port);
});

// Start the server
app.listen(port, () => {
  logger.info(`FortiSwitch simulator listening on port ${port}`);
  logger.info(`Simulating ${deviceCount} FortiSwitch devices for ${brand}`);
});

module.exports = app; // For testing
