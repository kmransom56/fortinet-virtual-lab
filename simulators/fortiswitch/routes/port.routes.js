import express from 'express';
import { body, param, validationResult } from 'express-validator';
import logger from '../utils/logger.js';
import persistenceService from '../services/persistence.service.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware.requireAuth);

// Get all ports for a switch
router.get('/:switchId', [
  param('switchId').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId } = req.params;
    logger.debug(`Fetching all ports for switch ${switchId}`);
    
    const state = await persistenceService.getState();
    const switchData = state.switches.find(s => s.id === switchId);
    
    if (!switchData) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    res.json(switchData.ports || []);
  } catch (error) {
    logger.error(`Error fetching ports for switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to fetch ports' });
  }
});

// Get a specific port
router.get('/:switchId/:portId', [
  param('switchId').isString().notEmpty(),
  param('portId').isInt({ min: 1, max: 48 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId, portId } = req.params;
    const portIdNum = parseInt(portId, 10);
    
    logger.debug(`Fetching port ${portId} for switch ${switchId}`);
    
    const state = await persistenceService.getState();
    const switchData = state.switches.find(s => s.id === switchId);
    
    if (!switchData) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    const port = switchData.ports.find(p => p.id === portIdNum);
    
    if (!port) {
      return res.status(404).json({ error: 'Port not found' });
    }
    
    res.json(port);
  } catch (error) {
    logger.error(`Error fetching port ${req.params.portId} for switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to fetch port' });
  }
});

// Update a port
router.put('/:switchId/:portId', [
  param('switchId').isString().notEmpty(),
  param('portId').isInt({ min: 1, max: 48 }),
  body('status').optional().isIn(['up', 'down']),
  body('vlan').optional().isInt({ min: 1, max: 4095 }),
  body('poe').optional().isBoolean(),
  body('speed').optional().isIn(['auto', '10M', '100M', '1G', '10G']),
  body('duplex').optional().isIn(['auto', 'half', 'full']),
  body('description').optional().isString().trim().isLength({ max: 255 }),
  body('taggedVlans').optional().isArray(),
  body('taggedVlans.*').optional().isInt({ min: 1, max: 4095 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId, portId } = req.params;
    const portIdNum = parseInt(portId, 10);
    const updates = req.body;
    
    logger.info(`Updating port ${portId} on switch ${switchId}`, updates);
    
    const state = await persistenceService.getState();
    const switchIndex = state.switches.findIndex(s => s.id === switchId);
    
    if (switchIndex === -1) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    const portIndex = state.switches[switchIndex].ports.findIndex(p => p.id === portIdNum);
    
    if (portIndex === -1) {
      return res.status(404).json({ error: 'Port not found' });
    }
    
    // Get current port data
    const currentPort = state.switches[switchIndex].ports[portIndex];
    
    // Validate VLAN exists if being set
    if (updates.vlan !== undefined) {
      const vlanExists = state.switches[switchIndex].vlans.some(v => v.id === updates.vlan);
      if (!vlanExists) {
        return res.status(400).json({ error: 'VLAN does not exist' });
      }
    }
    
    // Validate tagged VLANs exist if being set
    if (updates.taggedVlans && Array.isArray(updates.taggedVlans)) {
      for (const vlanId of updates.taggedVlans) {
        const vlanExists = state.switches[switchIndex].vlans.some(v => v.id === vlanId);
        if (!vlanExists) {
          return res.status(400).json({ error: `Tagged VLAN ${vlanId} does not exist` });
        }
      }
    }
    
    // Update port
    const updatedPort = {
      ...currentPort,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // If port is being disabled, ensure POE is also disabled
    if (updates.status === 'down' && currentPort.poe) {
      updatedPort.poe = false;
    }
    
    // Update in state
    state.switches[switchIndex].ports[portIndex] = updatedPort;
    await persistenceService.updateState(state);
    
    // Emit event
    req.app.get('io').to(`switch:${switchId}`).emit('port:updated', {
      switchId,
      portId: portIdNum,
      ...updates
    });
    
    // If port status changed, log the event
    if (updates.status && updates.status !== currentPort.status) {
      logger.info(`Port ${portId} status changed to ${updates.status} on switch ${switchId}`);
      
      // Emit port status change event
      req.app.get('io').to(`switch:${switchId}`).emit('port:statusChange', {
        switchId,
        portId: portIdNum,
        status: updates.status,
        previousStatus: currentPort.status,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(updatedPort);
  } catch (error) {
    logger.error(`Error updating port ${req.params.portId} on switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to update port' });
  }
});

// Reset a port to defaults
router.post('/:switchId/:portId/reset', [
  param('switchId').isString().notEmpty(),
  param('portId').isInt({ min: 1, max: 48 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId, portId } = req.params;
    const portIdNum = parseInt(portId, 10);
    
    logger.info(`Resetting port ${portId} on switch ${switchId} to defaults`);
    
    const state = await persistenceService.getState();
    const switchIndex = state.switches.findIndex(s => s.id === switchId);
    
    if (switchIndex === -1) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    const portIndex = state.switches[switchIndex].ports.findIndex(p => p.id === portIdNum);
    
    if (portIndex === -1) {
      return res.status(404).json({ error: 'Port not found' });
    }
    
    // Get current port to preserve some properties
    const currentPort = state.switches[switchIndex].ports[portIndex];
    
    // Reset to defaults
    const defaultPort = {
      id: portIdNum,
      name: `port${portIdNum}`,
      type: portIdNum <= 44 ? 'RJ45' : 'SFP+',
      status: 'down',
      vlan: 1,
      speed: portIdNum <= 44 ? '1G' : '10G',
      duplex: 'auto',
      poe: portIdNum <= 24, // First 24 ports have PoE
      poePriority: 'low',
      description: '',
      taggedVlans: [],
      macAddresses: [],
      createdAt: currentPort.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Update port
    state.switches[switchIndex].ports[portIndex] = defaultPort;
    await persistenceService.updateState(state);
    
    // Emit event
    req.app.get('io').to(`switch:${switchId}`).emit('port:reset', {
      switchId,
      portId: portIdNum
    });
    
    res.json(defaultPort);
  } catch (error) {
    logger.error(`Error resetting port ${req.params.portId} on switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to reset port' });
  }
});

// Get port statistics
router.get('/:switchId/:portId/statistics', [
  param('switchId').isString().notEmpty(),
  param('portId').isInt({ min: 1, max: 48 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId, portId } = req.params;
    const portIdNum = parseInt(portId, 10);
    
    logger.debug(`Fetching statistics for port ${portId} on switch ${switchId}`);
    
    const state = await persistenceService.getState();
    const switchData = state.switches.find(s => s.id === switchId);
    
    if (!switchData) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    const port = switchData.ports.find(p => p.id === portIdNum);
    
    if (!port) {
      return res.status(404).json({ error: 'Port not found' });
    }
    
    // Generate some mock statistics
    const now = new Date();
    const uptime = Math.floor(Math.random() * 86400); // Up to 24 hours
    
    const stats = {
      portId: portIdNum,
      status: port.status,
      speed: port.speed,
      duplex: port.duplex,
      vlan: port.vlan,
      lastChange: new Date(now - (Math.random() * 86400000)).toISOString(), // Last 24 hours
      uptime: uptime,
      rxPackets: Math.floor(Math.random() * 1000000),
      txPackets: Math.floor(Math.random() * 1000000),
      rxBytes: Math.floor(Math.random() * 1000000000),
      txBytes: Math.floor(Math.random() * 1000000000),
      rxErrors: Math.floor(Math.random() * 100),
      txErrors: Math.floor(Math.random() * 50),
      rxDropped: Math.floor(Math.random() * 20),
      txDropped: Math.floor(Math.random() * 10),
      rxMulticast: Math.floor(Math.random() * 5000),
      rxBroadcast: Math.floor(Math.random() * 1000),
      txMulticast: Math.floor(Math.random() * 1000),
      txBroadcast: Math.floor(Math.random() * 500),
      collisions: Math.floor(Math.random() * 10),
      lastClear: new Date(now - (Math.random() * 86400000)).toISOString(),
      timestamp: now.toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    logger.error(`Error fetching statistics for port ${req.params.portId} on switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to fetch port statistics' });
  }
});

export default router;
