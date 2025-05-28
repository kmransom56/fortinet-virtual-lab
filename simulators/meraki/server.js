/**
 * Meraki Dashboard API Simulator
 * 
 * This server simulates the Meraki Dashboard API for the Fortinet Virtual Lab.
 */

// Load environment variables
require('dotenv').config();

// Import dependencies
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Create Express app
const app = express();
const port = process.env.PORT || 3003;

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/meraki-simulator.log' })
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

// Meraki organization and network data
let merakiState = {
  apiKey: 'meraki-api-key-123456',
  organization: {
    id: 'org_123456789012345678',
    name: 'Restaurant Brands International'
  },
  networks: [
    {
      id: 'N_123456789012345678',
      organizationId: 'org_123456789012345678',
      name: 'Arbys-Network',
      timeZone: 'America/New_York',
      tags: ['arbys', 'production'],
      productTypes: ['switch']
    },
    {
      id: 'N_234567890123456789',
      organizationId: 'org_123456789012345678',
      name: 'BWW-Network',
      timeZone: 'America/Chicago',
      tags: ['bww', 'production'],
      productTypes: ['switch']
    }
  ],
  devices: [
    {
      serial: 'Q2HP-XXXX-1234',
      networkId: 'N_123456789012345678',
      model: 'MS120-24',
      name: 'ARB-SW01',
      tags: ['floor-1', 'pos'],
      status: 'online'
    },
    {
      serial: 'Q2HP-XXXX-2345',
      networkId: 'N_123456789012345678',
      model: 'MS120-48',
      name: 'ARB-SW02',
      tags: ['floor-2', 'office'],
      status: 'online'
    },
    {
      serial: 'Q2HP-XXXX-3456',
      networkId: 'N_234567890123456789',
      model: 'MS120-24',
      name: 'BWW-SW01',
      tags: ['floor-1', 'pos'],
      status: 'online'
    },
    {
      serial: 'Q2HP-XXXX-4567',
      networkId: 'N_234567890123456789',
      model: 'MS120-48',
      name: 'BWW-SW02',
      tags: ['floor-2', 'office'],
      status: 'online'
    }
  ],
  ports: {}
};

// Initialize ports for each device
merakiState.devices.forEach(device => {
  const portCount = device.model.includes('24') ? 24 : 48;
  merakiState.ports[device.serial] = [];
  
  for (let i = 1; i <= portCount; i++) {
    merakiState.ports[device.serial].push({
      portId: i.toString(),
      name: `Port ${i}`,
      tags: [],
      enabled: true,
      type: i === portCount ? 'trunk' : 'access',
      vlan: i === portCount ? 1 : 10,
      status: 'connected',
      speed: '1 Gbps',
      duplex: 'full'
    });
  }
});

// Load initial state from file if it exists
const stateFile = path.join('data', 'meraki-state.json');
if (fs.existsSync(stateFile)) {
  try {
    const savedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    merakiState = savedState;
    logger.info('Loaded Meraki state from file');
  } catch (error) {
    logger.error('Failed to load Meraki state from file', { error: error.message });
  }
}

// Save state periodically
setInterval(() => {
  try {
    fs.writeFileSync(stateFile, JSON.stringify(merakiState, null, 2));
    logger.debug('Saved Meraki state to file');
  } catch (error) {
    logger.error('Failed to save Meraki state to file', { error: error.message });
  }
}, 60000); // Save every minute

// Middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// API Key authentication middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-cisco-meraki-api-key'];
  
  if (!apiKey || apiKey !== merakiState.apiKey) {
    return res.status(401).json({ errors: ['Invalid API key'] });
  }
  
  next();
};

// API Routes

// Organization endpoints
app.get('/api/v1/organizations', authenticateApiKey, (req, res) => {
  res.json([merakiState.organization]);
});

// Network endpoints
app.get('/api/v1/organizations/:organizationId/networks', authenticateApiKey, (req, res) => {
  const { organizationId } = req.params;
  
  if (organizationId !== merakiState.organization.id) {
    return res.status(404).json({ errors: ['Organization not found'] });
  }
  
  res.json(merakiState.networks);
});

// Device endpoints
app.get('/api/v1/networks/:networkId/devices', authenticateApiKey, (req, res) => {
  const { networkId } = req.params;
  const devices = merakiState.devices.filter(d => d.networkId === networkId);
  res.json(devices);
});

// Switch port endpoints
app.get('/api/v1/devices/:serial/switch/ports', authenticateApiKey, (req, res) => {
  const { serial } = req.params;
  const ports = merakiState.ports[serial] || [];
  res.json(ports);
});

app.put('/api/v1/devices/:serial/switch/ports/:portId', authenticateApiKey, (req, res) => {
  const { serial, portId } = req.params;
  const { name, enabled, type, vlan } = req.body;
  
  const ports = merakiState.ports[serial] || [];
  const portIndex = ports.findIndex(p => p.portId === portId);
  
  if (portIndex === -1) {
    return res.status(404).json({ errors: ['Port not found'] });
  }
  
  // Update allowed fields
  if (name !== undefined) {
    merakiState.ports[serial][portIndex].name = name;
  }
  
  if (enabled !== undefined) {
    merakiState.ports[serial][portIndex].enabled = enabled;
    // Update status based on enabled state
    merakiState.ports[serial][portIndex].status = enabled ? 'connected' : 'disabled';
  }
  
  if (type !== undefined) {
    merakiState.ports[serial][portIndex].type = type;
  }
  
  if (vlan !== undefined) {
    merakiState.ports[serial][portIndex].vlan = vlan;
  }
  
  res.json(merakiState.ports[serial][portIndex]);
});

// Health check endpoint (no authentication required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Start server
app.listen(port, () => {
  logger.info(`Meraki Simulator running on port ${port}`);
});

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Shutting down Meraki Simulator');
  // Save state before exit
  try {
    fs.writeFileSync(stateFile, JSON.stringify(merakiState, null, 2));
    logger.info('Saved Meraki state before shutdown');
  } catch (error) {
    logger.error('Failed to save Meraki state before shutdown', { error: error.message });
  }
  process.exit(0);
});

module.exports = app; // Export for testing