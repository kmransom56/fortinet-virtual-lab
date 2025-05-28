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
  defaultMeta: { service: 'meraki-simulator' },
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
const brands = (process.env.BRANDS || 'arbys,bww').split(',');
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
    const configPath = path.join(__dirname, 'configs', `${brand}_meraki_config.json`);
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

// Generate organization and network data
const organizations = [
  {
    id: 'org_123456',
    name: 'Virtual Lab Organization',
    url: 'https://n1.meraki.com/o/org_123456/manage/organization/overview'
  }
];

const networks = [];
brands.forEach((brand, index) => {
  networks.push({
    id: `net_${brand}_${index}`,
    organizationId: 'org_123456',
    name: `${brand.toUpperCase()} Network`,
    timeZone: 'America/New_York',
    tags: [brand, 'virtual-lab'],
    type: 'combined',
    enrollmentString: `${brand}-enrollment-${Math.random().toString(36).substring(2, 10)}`,
    url: `https://n1.meraki.com/o/org_123456/manage/network/n_${brand}_${index}/overview`
  });
});

// Generate switch data
const switches = [];

// Distribute switches across brands evenly
const switchesPerBrand = Math.floor(deviceCount / brands.length);
let remainingSwitches = deviceCount - (switchesPerBrand * brands.length);

brands.forEach((brand, brandIndex) => {
  const brandNetwork = networks.find(n => n.name === `${brand.toUpperCase()} Network`);
  const brandSwitches = switchesPerBrand + (remainingSwitches > 0 ? 1 : 0);
  if (remainingSwitches > 0) remainingSwitches--;
  
  for (let i = 1; i <= brandSwitches; i++) {
    const switchNumber = switches.length + 1;
    switches.push({
      serial: `QBZY-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      networkId: brandNetwork.id,
      model: getRandomModel(),
      name: `${brand.toUpperCase()}-MS-${i}`,
      mac: generateRandomMac(),
      firmware: '14.32',
      address: `${brand.toUpperCase()} Location ${i}`,
      lanIp: `10.${brandIndex + 1}.2.${i + 10}`,
      status: getRandomStatus(),
      ports: generatePorts(),
      vlans: generateVlans(),
      metrics: {
        utilization: Math.floor(Math.random() * 100),
        clientCount: Math.floor(Math.random() * 50),
        uptimeSeconds: Math.floor(Math.random() * 2592000) // Up to 30 days
      },
      brand: brand,
      // Merge with config data if available
      ...configData[brand]
    });
  }
});

// Helper functions
function getRandomModel() {
  const models = [
    'MS220-8P',
    'MS250-24P',
    'MS350-48FP',
    'MS425-16',
    'MS120-8FP'
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

function generatePorts() {
  const portCount = getRandomPortCount();
  const ports = [];
  
  for (let i = 1; i <= portCount; i++) {
    const isUplink = i > portCount - 4;
    
    ports.push({
      number: i,
      name: isUplink ? `Uplink ${i}` : `Port ${i}`,
      type: isUplink ? 'SFP+' : 'RJ45',
      status: Math.random() > 0.2 ? 'connected' : 'disconnected',
      vlan: Math.floor(Math.random() * 5) + 1,
      enabled: Math.random() > 0.1,
      poe: !isUplink && Math.random() > 0.3,
      speed: isUplink ? '10G' : '1G',
      duplex: 'full',
      clients: []
    });
  }
  
  return ports;
}

function getRandomPortCount() {
  const portCounts = [8, 24, 48];
  return portCounts[Math.floor(Math.random() * portCounts.length)];
}

function generateVlans() {
  return [
    { id: 1, name: 'Default', subnet: '192.168.1.0/24' },
    { id: 10, name: 'Data', subnet: '192.168.10.0/24' },
    { id: 20, name: 'Voice', subnet: '192.168.20.0/24' },
    { id: 30, name: 'Management', subnet: '192.168.30.0/24' },
    { id: 40, name: 'Guest', subnet: '192.168.40.0/24' }
  ];
}

// Helper function to generate random MAC address
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

// Meraki Dashboard API format routes

// Get organizations
app.get('/api/v1/organizations', (req, res) => {
  logger.info('GET /api/v1/organizations');
  res.json(organizations);
});

// Get networks for an organization
app.get('/api/v1/organizations/:organizationId/networks', (req, res) => {
  const organizationId = req.params.organizationId;
  logger.info(`GET /api/v1/organizations/${organizationId}/networks`);
  
  const orgNetworks = networks.filter(network => network.organizationId === organizationId);
  res.json(orgNetworks);
});

// Get devices for a network
app.get('/api/v1/networks/:networkId/devices', (req, res) => {
  const networkId = req.params.networkId;
  logger.info(`GET /api/v1/networks/${networkId}/devices`);
  
  const networkDevices = switches.filter(device => device.networkId === networkId);
  res.json(networkDevices);
});

// Get a specific device
app.get('/api/v1/devices/:serial', (req, res) => {
  const serial = req.params.serial;
  logger.info(`GET /api/v1/devices/${serial}`);
  
  const device = switches.find(device => device.serial === serial);
  if (!device) {
    logger.error(`Device with serial ${serial} not found`);
    return res.status(404).json({ error: 'Device not found' });
  }
  
  res.json(device);
});

// Get switch ports
app.get('/api/v1/devices/:serial/switchPorts', (req, res) => {
  const serial = req.params.serial;
  logger.info(`GET /api/v1/devices/${serial}/switchPorts`);
  
  const device = switches.find(device => device.serial === serial);
  if (!device) {
    logger.error(`Device with serial ${serial} not found`);
    return res.status(404).json({ error: 'Device not found' });
  }
  
  res.json(device.ports);
});

// Update a switch port
app.put('/api/v1/devices/:serial/switchPorts/:portId', (req, res) => {
  const serial = req.params.serial;
  const portId = parseInt(req.params.portId);
  logger.info(`PUT /api/v1/devices/${serial}/switchPorts/${portId}`);
  
  const device = switches.find(device => device.serial === serial);
  if (!device) {
    logger.error(`Device with serial ${serial} not found`);
    return res.status(404).json({ error: 'Device not found' });
  }
  
  const port = device.ports.find(port => port.number === portId);
  if (!port) {
    logger.error(`Port with ID ${portId} not found on device ${serial}`);
    return res.status(404).json({ error: 'Port not found' });
  }
  
  // Update port properties
  Object.assign(port, req.body);
  logger.info(`Updated port ${portId} on device ${serial}`);
  
  res.json(port);
});

// Get switch VLANs
app.get('/api/v1/networks/:networkId/vlans', (req, res) => {
  const networkId = req.params.networkId;
  logger.info(`GET /api/v1/networks/${networkId}/vlans`);
  
  const device = switches.find(device => device.networkId === networkId);
  if (!device) {
    logger.error(`No devices found in network ${networkId}`);
    return res.status(404).json({ error: 'No devices found in network' });
  }
  
  res.json(device.vlans);
});

// Start the server
app.listen(port, () => {
  logger.info(`Meraki simulator listening on port ${port}`);
  logger.info(`Simulating ${deviceCount} Meraki switches across ${brands.length} brands`);
  brands.forEach(brand => {
    const brandSwitches = switches.filter(sw => sw.brand === brand).length;
    logger.info(`- ${brand}: ${brandSwitches} Meraki switches`);
  });
});

module.exports = app; // For testing
