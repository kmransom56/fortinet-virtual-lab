import express from 'express';
import { body, param, validationResult } from 'express-validator';
import logger from '../utils/logger.js';
import persistenceService from '../services/persistence.service.js';
import { getSTPStatus } from '../services/stp.service.js';
import { getTrafficStats } from '../services/traffic.service.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware.requireAuth);

// Get all switches
router.get('/', async (req, res) => {
  try {
    logger.debug('Fetching all switches');
    const state = await persistenceService.getState();
    
    // Add STP status to each switch if available
    const switches = await Promise.all(state.switches.map(async (sw) => {
      const stpStatus = getSTPStatus(sw.id);
      const trafficStats = getTrafficStats(sw.id);
      
      return {
        ...sw,
        stp: stpStatus || { enabled: false },
        traffic: trafficStats || {}
      };
    }));
    
    res.json(switches);
  } catch (error) {
    logger.error('Error fetching switches:', error);
    res.status(500).json({ error: 'Failed to fetch switches' });
  }
});

// Get a single switch by ID
router.get('/:id', [
  param('id').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { id } = req.params;
    logger.debug(`Fetching switch ${id}`);
    
    const state = await persistenceService.getState();
    const switchData = state.switches.find(s => s.id === id);
    
    if (!switchData) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    // Add STP status and traffic stats
    const stpStatus = getSTPStatus(id);
    const trafficStats = getTrafficStats(id);
    
    res.json({
      ...switchData,
      stp: stpStatus || { enabled: false },
      traffic: trafficStats || {}
    });
  } catch (error) {
    logger.error(`Error fetching switch ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch switch' });
  }
});

// Create a new switch
router.post('/', [
  body('id').isString().notEmpty(),
  body('name').optional().isString(),
  body('model').optional().isString(),
  body('ports').optional().isArray(),
  body('vlans').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { id, name, model, ports = [], vlans = [] } = req.body;
    logger.info(`Creating new switch ${id}`, { name, model });
    
    const state = await persistenceService.getState();
    
    // Check if switch already exists
    if (state.switches.some(s => s.id === id)) {
      return res.status(409).json({ error: 'Switch already exists' });
    }
    
    // Create new switch
    const newSwitch = {
      id,
      name: name || `Switch-${id}`,
      model: model || 'FortiSwitch-448D-FPOE',
      serialNumber: `FSW${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      firmwareVersion: '7.2.3',
      managementIp: `10.0.0.${state.switches.length + 100}`,
      status: 'online',
      ports: ports.length ? ports : generateDefaultPorts(),
      vlans: vlans.length ? vlans : generateDefaultVlans(),
      stats: {
        cpuUsage: 0,
        memoryUsage: 0,
        uptimeSeconds: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to state
    state.switches.push(newSwitch);
    await persistenceService.updateState(state);
    
    // Emit event
    req.app.get('io').emit('switch:created', newSwitch);
    
    res.status(201).json(newSwitch);
  } catch (error) {
    logger.error('Error creating switch:', error);
    res.status(500).json({ error: 'Failed to create switch' });
  }
});

// Update a switch
router.put('/:id', [
  param('id').isString().notEmpty(),
  body('name').optional().isString(),
  body('status').optional().isIn(['online', 'offline', 'maintenance']),
  body('managementIp').optional().isIP(),
  body('firmwareVersion').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { id } = req.params;
    const updates = req.body;
    
    logger.info(`Updating switch ${id}`, updates);
    
    const state = await persistenceService.getState();
    const switchIndex = state.switches.findIndex(s => s.id === id);
    
    if (switchIndex === -1) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    // Update switch properties
    const updatedSwitch = {
      ...state.switches[switchIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Update in state
    state.switches[switchIndex] = updatedSwitch;
    await persistenceService.updateState(state);
    
    // Emit event
    req.app.get('io').to(`switch:${id}`).emit('switch:updated', updatedSwitch);
    
    res.json(updatedSwitch);
  } catch (error) {
    logger.error(`Error updating switch ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update switch' });
  }
});

// Delete a switch
router.delete('/:id', [
  param('id').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { id } = req.params;
    logger.info(`Deleting switch ${id}`);
    
    const state = await persistenceService.getState();
    const switchIndex = state.switches.findIndex(s => s.id === id);
    
    if (switchIndex === -1) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    // Remove switch
    const [deletedSwitch] = state.switches.splice(switchIndex, 1);
    await persistenceService.updateState(state);
    
    // Emit event
    req.app.get('io').emit('switch:deleted', { id });
    
    res.status(204).send();
  } catch (error) {
    logger.error(`Error deleting switch ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete switch' });
  }
});

// Get switch ports
router.get('/:id/ports', [
  param('id').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { id } = req.params;
    logger.debug(`Fetching ports for switch ${id}`);
    
    const state = await persistenceService.getState();
    const switchData = state.switches.find(s => s.id === id);
    
    if (!switchData) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    res.json(switchData.ports || []);
  } catch (error) {
    logger.error(`Error fetching ports for switch ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch switch ports' });
  }
});

// Update a port
router.put('/:switchId/ports/:portId', [
  param('switchId').isString().notEmpty(),
  param('portId').isInt({ min: 1, max: 48 }),
  body('status').optional().isIn(['up', 'down']),
  body('vlan').optional().isInt({ min: 1, max: 4095 }),
  body('poe').optional().isBoolean(),
  body('speed').optional().isIn(['auto', '10M', '100M', '1G', '10G']),
  body('duplex').optional().isIn(['auto', 'half', 'full'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId, portId } = req.params;
    const updates = req.body;
    
    logger.info(`Updating port ${portId} on switch ${switchId}`, updates);
    
    const state = await persistenceService.getState();
    const switchIndex = state.switches.findIndex(s => s.id === switchId);
    
    if (switchIndex === -1) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    const portIndex = state.switches[switchIndex].ports.findIndex(p => p.id === parseInt(portId));
    
    if (portIndex === -1) {
      return res.status(404).json({ error: 'Port not found' });
    }
    
    // Update port
    const updatedPort = {
      ...state.switches[switchIndex].ports[portIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Update in state
    state.switches[switchIndex].ports[portIndex] = updatedPort;
    await persistenceService.updateState(state);
    
    // Emit event
    req.app.get('io').to(`switch:${switchId}`).emit('port:updated', {
      switchId,
      portId: parseInt(portId),
      ...updates
    });
    
    res.json(updatedPort);
  } catch (error) {
    logger.error(`Error updating port ${req.params.portId} on switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to update port' });
  }
});

// Helper functions
function generateDefaultPorts(count = 48) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `port${i + 1}`,
    type: i < 44 ? 'RJ45' : 'SFP+',
    speed: i < 44 ? '1G' : '10G',
    status: 'down',
    vlan: 1,
    poe: i < 24, // First 24 ports have PoE
    macAddresses: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
}

function generateDefaultVlans() {
  return [
    { id: 1, name: 'default', status: 'active', taggedPorts: [] },
    { id: 10, name: 'mgmt', status: 'active', taggedPorts: [] },
    { id: 20, name: 'voice', status: 'active', taggedPorts: [] },
    { id: 30, name: 'data', status: 'active', taggedPorts: [] },
    { id: 40, name: 'guest', status: 'active', taggedPorts: [] }
  ];
}

export default router;
