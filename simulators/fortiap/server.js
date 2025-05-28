/**
 * FortiAP API Simulator
 * 
 * This server simulates the API of FortiAP devices for the Fortinet Virtual Lab.
 * It provides realistic API responses for FortiAP management operations.
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
const port = process.env.PORT || 3002;

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/fortiap-simulator.log' })
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

// FortiAP simulation state
let apState = {
  hostname: 'FAP-221E-ARBYS',
  serial: 'FP221ETF1800001',
  firmware: 'FortiAP 6.4-build0360',
  model: 'FAP-221E',
  uptime: 876543,
  cpu: 15,
  memory: 42,
  ip_address: '192.168.1.10',
  connection: {
    status: 'connected',
    fortigate: 'FG-ARB-HQ01',
    uptime: 875432,
    controller_ip: '192.168.1.1'
  },
  radios: [
    {
      id: 1,
      type: '2.4GHz',
      status: 'enabled',
      channel: 6,
      txpower: 100,
      clients: 12
    },
    {
      id: 2,
      type: '5GHz',
      status: 'enabled',
      channel: 36,
      txpower: 100,
      clients: 8
    }
  ],
  ssids: [
    {
      name: 'Arbys-Corporate',
      vlan: 10,
      radio: 1,
      security: 'wpa2-enterprise',
      encryption: 'aes',
      status: 'enabled',
      clients: 5
    },
    {
      name: 'Arbys-Guest',
      vlan: 20,
      radio: 1,
      security: 'wpa2-personal',
      encryption: 'aes',
      status: 'enabled',
      clients: 7
    },
    {
      name: 'Arbys-Corporate',
      vlan: 10,
      radio: 2,
      security: 'wpa2-enterprise',
      encryption: 'aes',
      status: 'enabled',
      clients: 6
    },
    {
      name: 'Arbys-Guest',
      vlan: 20,
      radio: 2,
      security: 'wpa2-personal',
      encryption: 'aes',
      status: 'enabled',
      clients: 2
    }
  ],
  clients: [
    {
      mac: '00:11:22:33:44:55',
      ip: '192.168.10.101',
      hostname: 'corporate-laptop1',
      ssid: 'Arbys-Corporate',
      vlan: 10,
      radio: 1,
      signal: -65,
      data_rate: 144,
      connected_since: 1653578765
    },
    {
      mac: '00:11:22:33:44:56',
      ip: '192.168.10.102',
      hostname: 'corporate-laptop2',
      ssid: 'Arbys-Corporate',
      vlan: 10,
      radio: 1,
      signal: -58,
      data_rate: 240,
      connected_since: 1653578946
    },
    {
      mac: 'aa:bb:cc:11:22:33',
      ip: '192.168.20.101',
      hostname: 'guest-phone1',
      ssid: 'Arbys-Guest',
      vlan: 20,
      radio: 1,
      signal: -72,
      data_rate: 72,
      connected_since: 1653579012
    }
    // Additional clients would be listed here
  ]
};

// Load initial state from file if it exists
const stateFile = path.join('data', 'ap-state.json');
if (fs.existsSync(stateFile)) {
  try {
    const savedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    apState = savedState;
    logger.info('Loaded FortiAP state from file');
  } catch (error) {
    logger.error('Failed to load FortiAP state from file', { error: error.message });
  }
}

// Save state periodically
setInterval(() => {
  try {
    fs.writeFileSync(stateFile, JSON.stringify(apState, null, 2));
    logger.debug('Saved FortiAP state to file');
  } catch (error) {
    logger.error('Failed to save FortiAP state to file', { error: error.message });
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
const JWT_SECRET = process.env.JWT_SECRET || 'fortiap-simulator-secret';
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
    hostname: apState.hostname,
    serial: apState.serial,
    firmware: apState.firmware,
    model: apState.model,
    ip_address: apState.ip_address,
    uptime: apState.uptime + Math.floor((Date.now() / 1000) % 86400), // Simulate increasing uptime
    cpu_usage: apState.cpu,
    memory_usage: apState.memory,
    status: 'active'
  });
});

// Connection status
app.get('/api/connection', authenticate, (req, res) => {
  res.json(apState.connection);
});

// Radio information
app.get('/api/radios', authenticate, (req, res) => {
  res.json({
    radios: apState.radios
  });
});

// Get specific radio
app.get('/api/radios/:id', authenticate, (req, res) => {
  const radioId = parseInt(req.params.id);
  const radioInfo = apState.radios.find(r => r.id === radioId);
  
  if (!radioInfo) {
    return res.status(404).json({ error: 'Radio not found' });
  }
  
  res.json(radioInfo);
});

// Update radio
app.put('/api/radios/:id', authenticate, (req, res) => {
  const radioId = parseInt(req.params.id);
  const radioIndex = apState.radios.findIndex(r => r.id === radioId);
  
  if (radioIndex === -1) {
    return res.status(404).json({ error: 'Radio not found' });
  }
  
  // Update allowed fields
  const { status, channel, txpower } = req.body;
  
  if (status !== undefined) {
    apState.radios[radioIndex].status = status;
  }
  
  if (channel !== undefined) {
    // Validate channel based on radio type
    if (apState.radios[radioIndex].type === '2.4GHz') {
      if (channel >= 1 && channel <= 11) {
        apState.radios[radioIndex].channel = channel;
      } else {
        return res.status(400).json({ error: 'Invalid 2.4GHz channel (valid: 1-11)' });
      }
    } else if (apState.radios[radioIndex].type === '5GHz') {
      // Simplified channel validation for 5GHz
      if ([36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149, 153, 157, 161, 165].includes(channel)) {
        apState.radios[radioIndex].channel = channel;
      } else {
        return res.status(400).json({ error: 'Invalid 5GHz channel' });
      }
    }
  }
  
  if (txpower !== undefined) {
    // Validate txpower (0-100%)
    if (txpower >= 0 && txpower <= 100) {
      apState.radios[radioIndex].txpower = txpower;
    } else {
      return res.status(400).json({ error: 'Invalid transmit power (valid: 0-100)' });
    }
  }
  
  res.json({
    success: true,
    radio: apState.radios[radioIndex]
  });
});

// Get SSIDs
app.get('/api/ssids', authenticate, (req, res) => {
  res.json({
    ssids: apState.ssids
  });
});

// Get specific SSID
app.get('/api/ssids/:name', authenticate, (req, res) => {
  const ssidName = req.params.name;
  const radioId = req.query.radio ? parseInt(req.query.radio) : null;
  
  let ssidInfo;
  if (radioId) {
    ssidInfo = apState.ssids.find(s => s.name === ssidName && s.radio === radioId);
  } else {
    ssidInfo = apState.ssids.filter(s => s.name === ssidName);
  }
  
  if (!ssidInfo || (Array.isArray(ssidInfo) && ssidInfo.length === 0)) {
    return res.status(404).json({ error: 'SSID not found' });
  }
  
  res.json(ssidInfo);
});

// Update SSID
app.put('/api/ssids/:name', authenticate, (req, res) => {
  const ssidName = req.params.name;
  const radioId = req.query.radio ? parseInt(req.query.radio) : null;
  
  if (!radioId) {
    return res.status(400).json({ error: 'Radio ID is required as a query parameter' });
  }
  
  const ssidIndex = apState.ssids.findIndex(s => s.name === ssidName && s.radio === radioId);
  
  if (ssidIndex === -1) {
    return res.status(404).json({ error: 'SSID not found' });
  }
  
  // Update allowed fields
  const { status, vlan, security, encryption } = req.body;
  
  if (status !== undefined) {
    apState.ssids[ssidIndex].status = status;
  }
  
  if (vlan !== undefined) {
    apState.ssids[ssidIndex].vlan = vlan;
  }
  
  if (security !== undefined) {
    // Validate security type
    if (['open', 'wep', 'wpa-personal', 'wpa2-personal', 'wpa3-personal', 'wpa-enterprise', 'wpa2-enterprise', 'wpa3-enterprise'].includes(security)) {
      apState.ssids[ssidIndex].security = security;
    } else {
      return res.status(400).json({ error: 'Invalid security type' });
    }
  }
  
  if (encryption !== undefined) {
    // Validate encryption type
    if (['none', 'wep', 'tkip', 'aes', 'tkip+aes'].includes(encryption)) {
      apState.ssids[ssidIndex].encryption = encryption;
    } else {
      return res.status(400).json({ error: 'Invalid encryption type' });
    }
  }
  
  res.json({
    success: true,
    ssid: apState.ssids[ssidIndex]
  });
});

// Get clients
app.get('/api/clients', authenticate, (req, res) => {
  // Optional filtering by SSID or radio
  const ssidFilter = req.query.ssid;
  const radioFilter = req.query.radio ? parseInt(req.query.radio) : null;
  
  let filteredClients = apState.clients;
  
  if (ssidFilter) {
    filteredClients = filteredClients.filter(client => client.ssid === ssidFilter);
  }
  
  if (radioFilter) {
    filteredClients = filteredClients.filter(client => client.radio === radioFilter);
  }
  
  res.json({
    total: filteredClients.length,
    clients: filteredClients
  });
});

// Get specific client
app.get('/api/clients/:mac', authenticate, (req, res) => {
  const mac = req.params.mac;
  const clientInfo = apState.clients.find(c => c.mac === mac);
  
  if (!clientInfo) {
    return res.status(404).json({ error: 'Client not found' });
  }
  
  res.json(clientInfo);
});

// Disconnect client
app.post('/api/clients/:mac/disconnect', authenticate, (req, res) => {
  const mac = req.params.mac;
  const clientIndex = apState.clients.findIndex(c => c.mac === mac);
  
  if (clientIndex === -1) {
    return res.status(404).json({ error: 'Client not found' });
  }
  
  // Remove client from array to simulate disconnection
  const removedClient = apState.clients.splice(clientIndex, 1)[0];
  
  // Update client count for the corresponding SSID and radio
  const ssidIndex = apState.ssids.findIndex(s => s.name === removedClient.ssid && s.radio === removedClient.radio);
  if (ssidIndex !== -1) {
    apState.ssids[ssidIndex].clients--;
  }
  
  // Update client count for the corresponding radio
  const radioIndex = apState.radios.findIndex(r => r.id === removedClient.radio);
  if (radioIndex !== -1) {
    apState.radios[radioIndex].clients--;
  }
  
  res.json({
    success: true,
    message: `Client ${mac} has been disconnected`
  });
});

// Health check endpoint (no authentication required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Start server
app.listen(port, () => {
  logger.info(`FortiAP Simulator running on port ${port}`);
});

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Shutting down FortiAP Simulator');
  // Save state before exit
  try {
    fs.writeFileSync(stateFile, JSON.stringify(apState, null, 2));
    logger.info('Saved FortiAP state before shutdown');
  } catch (error) {
    logger.error('Failed to save FortiAP state before shutdown', { error: error.message });
  }
  process.exit(0);
});

module.exports = app; // Export for testing