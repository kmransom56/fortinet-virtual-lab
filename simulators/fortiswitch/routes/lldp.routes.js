import express from 'express';
import { param, query, validationResult } from 'express-validator';
import logger from '../utils/logger.js';
import persistenceService from '../services/persistence.service.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware.requireAuth);

// Get LLDP status for a switch
router.get('/:switchId/status', [
  param('switchId').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId } = req.params;
    logger.debug(`Fetching LLDP status for switch ${switchId}`);
    
    const state = await persistenceService.getState();
    const switchData = state.switches.find(s => s.id === switchId);
    
    if (!switchData) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    // Default LLDP status
    const lldpStatus = {
      enabled: switchData.lldp?.enabled ?? true,
      holdtime: switchData.lldp?.holdtime ?? 120,
      reinitDelay: switchData.lldp?.reinitDelay ?? 2,
      txDelay: switchData.lldp?.txDelay ?? 30,
      txHold: switchData.lldp?.txHold ?? 4,
      notificationInterval: switchData.lldp?.notificationInterval ?? 5,
      systemName: switchData.lldp?.systemName ?? switchData.name,
      systemDescription: switchData.lldp?.systemDescription || `FortiSwitch ${switchData.model} running FortiOS 7.2.3`,
      managementAddress: switchData.lldp?.managementAddress || switchData.managementIp
    };
    
    res.json(lldpStatus);
  } catch (error) {
    logger.error(`Error fetching LLDP status for switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to fetch LLDP status' });
  }
});

// Update LLDP configuration
router.put('/:switchId/status', [
  param('switchId').isString().notEmpty(),
  body('enabled').optional().isBoolean(),
  body('holdtime').optional().isInt({ min: 1, max: 65535 }),
  body('reinitDelay').optional().isInt({ min: 1, max: 10 }),
  body('txDelay').optional().isInt({ min: 5, max: 32768 }),
  body('txHold').optional().isInt({ min: 1, max: 100 }),
  body('notificationInterval').optional().isInt({ min: 5, max: 3600 }),
  body('systemName').optional().isString(),
  body('systemDescription').optional().isString(),
  body('managementAddress').optional().isIP()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId } = req.params;
    const updates = req.body;
    
    logger.info(`Updating LLDP configuration for switch ${switchId}`, updates);
    
    const state = await persistenceService.getState();
    const switchIndex = state.switches.findIndex(s => s.id === switchId);
    
    if (switchIndex === -1) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    // Initialize LLDP config if it doesn't exist
    if (!state.switches[switchIndex].lldp) {
      state.switches[switchIndex].lldp = {};
    }
    
    // Update LLDP configuration
    Object.assign(state.switches[switchIndex].lldp, updates);
    
    // Update the switch's updatedAt timestamp
    state.switches[switchIndex].updatedAt = new Date().toISOString();
    
    await persistenceService.updateState(state);
    
    // Emit event
    req.app.get('io').to(`switch:${switchId}`).emit('lldp:updated', {
      switchId,
      ...updates
    });
    
    res.json(state.switches[switchIndex].lldp);
  } catch (error) {
    logger.error(`Error updating LLDP configuration for switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to update LLDP configuration' });
  }
});

// Get LLDP neighbors for a switch
router.get('/:switchId/neighbors', [
  param('switchId').isString().notEmpty(),
  query('portId').optional().isInt({ min: 1, max: 48 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId } = req.params;
    const { portId } = req.query;
    
    logger.debug(`Fetching LLDP neighbors for switch ${switchId}` + (portId ? ` port ${portId}` : ''));
    
    const state = await persistenceService.getState();
    const switchData = state.switches.find(s => s.id === switchId);
    
    if (!switchData) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    // In a real implementation, this would query the LLDP neighbor table
    // For simulation, we'll generate some mock neighbors
    const neighbors = [];
    
    // Only generate neighbors for ports that are up
    const ports = portId 
      ? [switchData.ports.find(p => p.id === parseInt(portId, 10))].filter(Boolean)
      : switchData.ports.filter(p => p.status === 'up');
    
    for (const port of ports) {
      // Only generate neighbors for some ports (randomly)
      if (Math.random() > 0.3) {
        const neighborSwitch = state.switches.find(s => 
          s.id !== switchId && 
          s.ports.some(p => p.status === 'up') &&
          Math.random() > 0.5 // 50% chance of having a neighbor
        );
        
        if (neighborSwitch) {
          // Find an up port on the neighbor switch
          const neighborPorts = neighborSwitch.ports.filter(p => p.status === 'up');
          if (neighborPorts.length > 0) {
            const neighborPort = neighborPorts[Math.floor(Math.random() * neighborPorts.length)];
            
            neighbors.push({
              localPort: port.id,
              localPortName: port.name,
              chassisId: neighborSwitch.serialNumber || `chassis-${neighborSwitch.id}`,
              portId: neighborPort.id,
              portDescription: neighborPort.name,
              systemName: neighborSwitch.name,
              systemDescription: `FortiSwitch ${neighborSwitch.model} running FortiOS 7.2.3`,
              systemCapabilities: ['bridge', 'router'],
              managementAddress: neighborSwitch.managementIp,
              ttl: 120,
              lastUpdate: new Date().toISOString()
            });
          }
        }
      }
    }
    
    res.json(neighbors);
  } catch (error) {
    logger.error(`Error fetching LLDP neighbors for switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to fetch LLDP neighbors' });
  }
});

// Get LLDP statistics for a switch
router.get('/:switchId/statistics', [
  param('switchId').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId } = req.params;
    logger.debug(`Fetching LLDP statistics for switch ${switchId}`);
    
    const state = await persistenceService.getState();
    const switchData = state.switches.find(s => s.id === switchId);
    
    if (!switchData) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    // In a real implementation, this would return actual statistics
    // For simulation, we'll generate some mock statistics
    const now = new Date();
    const uptime = Math.floor(Math.random() * 86400); // Up to 24 hours
    
    const stats = {
      lastClear: new Date(now - (Math.random() * 86400000)).toISOString(), // Last 24 hours
      entriesAged: Math.floor(Math.random() * 1000),
      frameIn: {
        total: Math.floor(Math.random() * 1000000),
        discarded: Math.floor(Math.random() * 1000),
        errors: Math.floor(Math.random() * 100),
        unrecognized: Math.floor(Math.random() * 100)
      },
      frameOut: {
        total: Math.floor(Math.random() * 1000000),
        discarded: Math.floor(Math.random() * 1000),
        errors: Math.floor(Math.random() * 100)
      },
      tlvDiscarded: {
        total: Math.floor(Math.random() * 1000),
        invalid: Math.floor(Math.random() * 100)
      },
      tlvUnknown: Math.floor(Math.random() * 100),
      lastChange: new Date(now - (Math.random() * 3600000)).toISOString(), // Last hour
      timestamp: now.toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    logger.error(`Error fetching LLDP statistics for switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to fetch LLDP statistics' });
  }
});

export default router;
