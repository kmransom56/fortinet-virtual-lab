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
  defaultMeta: { service: 'fortiap-simulator' },
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
const deviceCount = process.env.DEVICE_COUNT || 10;
const brands = (process.env.BRANDS || 'arbys,bww,sonic').split(',');
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
brands.forEach(brand => {
  try {
    const configPath = path.join(__dirname, 'configs', `${brand}_fortiap_config.json`);
    if (fs.existsSync(configPath)) {
      configData[brand] = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      logger.info(`Loaded configuration for ${brand} from ${configPath}`);
    } else {
      logger.info(`No configuration file found for ${brand} at ${configPath}, using default values`);
      configData[brand] = {};
    }
  } catch (error) {
    logger.error(`Error loading configuration for ${brand}: ${error.message}`);
    configData[brand] = {};
  }
});

// Generate access point data
const accessPoints = [];

// Distribute APs across brands evenly
const apPerBrand = Math.floor(deviceCount / brands.length);
let remainingAPs = deviceCount - (apPerBrand * brands.length);

brands.forEach((brand, brandIndex) => {
  const brandAPs = apPerBrand + (remainingAPs > 0 ? 1 : 0);
  if (remainingAPs > 0) remainingAPs--;
  
  for (let i = 1; i <= brandAPs; i++) {
    const apNumber = accessPoints.length + 1;
    accessPoints.push({
      id: `AP${apNumber.toString().padStart(3, '0')}`,
      name: `${brand.toUpperCase()}-AP-${i}`,
      model: getRandomModel(),
      serialNumber: `FAP${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      firmwareVersion: '6.4.9',
      ip: `10.${brandIndex + 1}.3.${i + 10}`,
      status: getRandomStatus(),
      connectedClients: Math.floor(Math.random() * 30),
      brand: brand,
      radio: {
        "2.4GHz": {
          channel: Math.floor(Math.random() * 11) + 1,
          txpower: Math.floor(Math.random() * 100),
          clients: Math.floor(Math.random() * 15)
        },
        "5GHz": {
          channel: [36, 40, 44, 48, 149, 153, 157, 161][Math.floor(Math.random() * 8)],
          txpower: Math.floor(Math.random() * 100),
          clients: Math.floor(Math.random() * 15)
        }
      },
      stats: {
        rxBytes: Math.floor(Math.random() * 1000000000),
        txBytes: Math.floor(Math.random() * 1000000000),
        uptime: Math.floor(Math.random() * 2592000) // Up to 30 days
      },
      ssids: [
        {
          name: `${brand.toUpperCase()}-Corporate`,
          security: 'WPA2-Enterprise',
          vlan: 10,
          enabled: true
        },
        {
          name: `${brand.toUpperCase()}-Guest`,
          security: 'WPA2-Personal',
          vlan: 20,
          enabled: true
        },
        {
          name: `${brand.toUpperCase()}-Voice`,
          security: 'WPA2-Enterprise',
          vlan: 30,
          enabled: brand === 'sonic' ? false : true
        }
      ],
      // Merge with config data if available
      ...configData[brand]
    });
  }
});

// Helper functions
function getRandomModel() {
  const models = [
    'FortiAP-231F',
    'FortiAP-431F',
    'FortiAP-C24JE',
    'FortiAP-U421EV',
    'FortiAP-221E'
  ];
  
  return models[Math.floor(Math.random() * models.length)];
}

function getRandomStatus() {
  const statuses = [
    'online',
    'online',
    'online',
    'online',
    'offline'
  ];
  
  return statuses[Math.floor(Math.random() * statuses.length)];
}

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Get all access points
app.get('/api/aps', (req, res) => {
  logger.info('GET /api/aps');
  
  // Filter by brand if provided
  const brand = req.query.brand;
  if (brand) {
    const filteredAPs = accessPoints.filter(ap => ap.brand === brand.toLowerCase());
    return res.json(filteredAPs);
  }
  
  res.json(accessPoints);
});

// Get specific access point
app.get('/api/aps/:id', (req, res) => {
  const apId = req.params.id;
  logger.info(`GET /api/aps/${apId}`);
  
  const ap = accessPoints.find(ap => ap.id === apId);
  if (!ap) {
    logger.error(`Access point with ID ${apId} not found`);
    return res.status(404).json({ error: 'Access point not found' });
  }
  
  res.json(ap);
});

// Get access point clients
app.get('/api/aps/:id/clients', (req, res) => {
  const apId = req.params.id;
  logger.info(`GET /api/aps/${apId}/clients`);
  
  const ap = accessPoints.find(ap => ap.id === apId);
  if (!ap) {
    logger.error(`Access point with ID ${apId} not found`);
    return res.status(404).json({ error: 'Access point not found' });
  }
  
  // Generate random clients
  const clients = [];
  const clientCount = ap.connectedClients;
  
  for (let i = 0; i < clientCount; i++) {
    clients.push({
      id: i + 1,
      mac: generateRandomMac(),
      ip: `10.${ap.ip.split('.')[1]}.3.${100 + i}`,
      hostname: `client-${i + 1}`,
      os: getRandomOS(),
      signal: -1 * (Math.floor(Math.random() * 50) + 30), // -30 to -80 dBm
      band: Math.random() > 0.5 ? '2.4GHz' : '5GHz',
      connected: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400), // Connected within last 24 hours
      dataRate: {
        rx: Math.floor(Math.random() * 100) + 10, // 10 to 110 Mbps
        tx: Math.floor(Math.random() * 300) + 100  // 100 to 400 Mbps
      },
      dataUsage: {
        rx: Math.floor(Math.random() * 1000000000), // Random bytes received
        tx: Math.floor(Math.random() * 1000000000)  // Random bytes transmitted
      }
    });
  }
  
  res.json(clients);
});

// Get access point SSIDs
app.get('/api/aps/:id/ssids', (req, res) => {
  const apId = req.params.id;
  logger.info(`GET /api/aps/${apId}/ssids`);
  
  const ap = accessPoints.find(ap => ap.id === apId);
  if (!ap) {
    logger.error(`Access point with ID ${apId} not found`);
    return res.status(404).json({ error: 'Access point not found' });
  }
  
  res.json(ap.ssids);
});

// Update access point status
app.put('/api/aps/:id/status', (req, res) => {
  const apId = req.params.id;
  logger.info(`PUT /api/aps/${apId}/status`);
  
  const ap = accessPoints.find(ap => ap.id === apId);
  if (!ap) {
    logger.error(`Access point with ID ${apId} not found`);
    return res.status(404).json({ error: 'Access point not found' });
  }
  
  if (!req.body.status || !['online', 'offline', 'upgrading'].includes(req.body.status)) {
    logger.error(`Invalid status: ${req.body.status}`);
    return res.status(400).json({ error: 'Invalid status. Must be one of: online, offline, upgrading' });
  }
  
  ap.status = req.body.status;
  logger.info(`Updated status of ${apId} to ${req.body.status}`);
  
  res.json(ap);
});

// Helper function to generate random MAC address
function generateRandomMac() {
  return Array(6).fill(0).map(() => {
    return Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }).join(':');
}

// Helper function to get random OS
function getRandomOS() {
  const osList = [
    'Android', 'Android', 'iOS', 'iOS', 'iOS', 
    'Windows', 'Windows', 'macOS', 'macOS', 
    'Linux', 'Chrome OS'
  ];
  
  return osList[Math.floor(Math.random() * osList.length)];
}

// Start the server
app.listen(port, () => {
  logger.info(`FortiAP simulator listening on port ${port}`);
  logger.info(`Simulating ${deviceCount} FortiAP devices across ${brands.length} brands`);
  brands.forEach(brand => {
    const brandAPs = accessPoints.filter(ap => ap.brand === brand).length;
    logger.info(`- ${brand}: ${brandAPs} FortiAP devices`);
  });
});

module.exports = app; // For testing
