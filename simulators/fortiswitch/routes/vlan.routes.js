import express from 'express';
import { body, param, validationResult } from 'express-validator';
import logger from '../utils/logger.js';
import persistenceService from '../services/persistence.service.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware.requireAuth);

// Get all VLANs for a switch
router.get('/:switchId', [
  param('switchId').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId } = req.params;
    logger.debug(`Fetching VLANs for switch ${switchId}`);
    
    const state = await persistenceService.getState();
    const switchData = state.switches.find(s => s.id === switchId);
    
    if (!switchData) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    res.json(switchData.vlans || []);
  } catch (error) {
    logger.error(`Error fetching VLANs for switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to fetch VLANs' });
  }
});

// Get a specific VLAN
router.get('/:switchId/:vlanId', [
  param('switchId').isString().notEmpty(),
  param('vlanId').isInt({ min: 1, max: 4095 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId, vlanId } = req.params;
    const vlanIdNum = parseInt(vlanId, 10);
    
    logger.debug(`Fetching VLAN ${vlanId} for switch ${switchId}`);
    
    const state = await persistenceService.getState();
    const switchData = state.switches.find(s => s.id === switchId);
    
    if (!switchData) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    const vlan = switchData.vlans.find(v => v.id === vlanIdNum);
    
    if (!vlan) {
      return res.status(404).json({ error: 'VLAN not found' });
    }
    
    res.json(vlan);
  } catch (error) {
    logger.error(`Error fetching VLAN ${req.params.vlanId} for switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to fetch VLAN' });
  }
});

// Create a new VLAN
router.post('/:switchId', [
  param('switchId').isString().notEmpty(),
  body('id').isInt({ min: 2, max: 4094 }),
  body('name').isString().notEmpty(),
  body('status').optional().isIn(['active', 'suspend', 'shutdown']),
  body('taggedPorts').optional().isArray(),
  body('untaggedPorts').optional().isArray(),
  body('description').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId } = req.params;
    const { id, name, status = 'active', taggedPorts = [], untaggedPorts = [], description = '' } = req.body;
    
    logger.info(`Creating VLAN ${id} (${name}) on switch ${switchId}`);
    
    const state = await persistenceService.getState();
    const switchIndex = state.switches.findIndex(s => s.id === switchId);
    
    if (switchIndex === -1) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    // Check if VLAN already exists
    if (state.switches[switchIndex].vlans.some(v => v.id === id)) {
      return res.status(409).json({ error: 'VLAN already exists' });
    }
    
    // Create new VLAN
    const newVlan = {
      id,
      name,
      status,
      taggedPorts: Array.isArray(taggedPorts) ? taggedPorts : [],
      untaggedPorts: Array.isArray(untaggedPorts) ? untaggedPorts : [],
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to switch
    state.switches[switchIndex].vlans.push(newVlan);
    await persistenceService.updateState(state);
    
    // Emit event
    req.app.get('io').to(`switch:${switchId}`).emit('vlan:created', newVlan);
    
    res.status(201).json(newVlan);
  } catch (error) {
    logger.error(`Error creating VLAN on switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to create VLAN' });
  }
});

// Update a VLAN
router.put('/:switchId/:vlanId', [
  param('switchId').isString().notEmpty(),
  param('vlanId').isInt({ min: 1, max: 4095 }),
  body('name').optional().isString().notEmpty(),
  body('status').optional().isIn(['active', 'suspend', 'shutdown']),
  body('taggedPorts').optional().isArray(),
  body('untaggedPorts').optional().isArray(),
  body('description').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId, vlanId } = req.params;
    const vlanIdNum = parseInt(vlanId, 10);
    const updates = req.body;
    
    logger.info(`Updating VLAN ${vlanId} on switch ${switchId}`, updates);
    
    const state = await persistenceService.getState();
    const switchIndex = state.switches.findIndex(s => s.id === switchId);
    
    if (switchIndex === -1) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    const vlanIndex = state.switches[switchIndex].vlans.findIndex(v => v.id === vlanIdNum);
    
    if (vlanIndex === -1) {
      return res.status(404).json({ error: 'VLAN not found' });
    }
    
    // Update VLAN
    const updatedVlan = {
      ...state.switches[switchIndex].vlans[vlanIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Update in state
    state.switches[switchIndex].vlans[vlanIndex] = updatedVlan;
    await persistenceService.updateState(state);
    
    // Emit event
    req.app.get('io').to(`switch:${switchId}`).emit('vlan:updated', updatedVlan);
    
    res.json(updatedVlan);
  } catch (error) {
    logger.error(`Error updating VLAN ${req.params.vlanId} on switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to update VLAN' });
  }
});

// Delete a VLAN
router.delete('/:switchId/:vlanId', [
  param('switchId').isString().notEmpty(),
  param('vlanId').isInt({ min: 1, max: 4095 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId, vlanId } = req.params;
    const vlanIdNum = parseInt(vlanId, 10);
    
    // Prevent deletion of default VLAN (VLAN 1)
    if (vlanIdNum === 1) {
      return res.status(400).json({ error: 'Cannot delete default VLAN (1)' });
    }
    
    logger.info(`Deleting VLAN ${vlanId} from switch ${switchId}`);
    
    const state = await persistenceService.getState();
    const switchIndex = state.switches.findIndex(s => s.id === switchId);
    
    if (switchIndex === -1) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    const vlanIndex = state.switches[switchIndex].vlans.findIndex(v => v.id === vlanIdNum);
    
    if (vlanIndex === -1) {
      return res.status(404).json({ error: 'VLAN not found' });
    }
    
    // Remove VLAN
    state.switches[switchIndex].vlans.splice(vlanIndex, 1);
    
    // Remove VLAN from any port configurations
    state.switches[switchIndex].ports.forEach(port => {
      if (port.vlan === vlanIdNum) {
        port.vlan = 1; // Reassign to default VLAN
      }
      
      // Remove from tagged ports if present
      if (port.taggedVlans) {
        port.taggedVlans = port.taggedVlans.filter(id => id !== vlanIdNum);
      }
    });
    
    await persistenceService.updateState(state);
    
    // Emit event
    req.app.get('io').to(`switch:${switchId}`).emit('vlan:deleted', { id: vlanIdNum });
    
    res.status(204).send();
  } catch (error) {
    logger.error(`Error deleting VLAN ${req.params.vlanId} from switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to delete VLAN' });
  }
});

// Get ports for a specific VLAN
router.get('/:switchId/:vlanId/ports', [
  param('switchId').isString().notEmpty(),
  param('vlanId').isInt({ min: 1, max: 4095 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { switchId, vlanId } = req.params;
    const vlanIdNum = parseInt(vlanId, 10);
    
    logger.debug(`Fetching ports for VLAN ${vlanId} on switch ${switchId}`);
    
    const state = await persistenceService.getState();
    const switchData = state.switches.find(s => s.id === switchId);
    
    if (!switchData) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    // Check if VLAN exists
    const vlan = switchData.vlans.find(v => v.id === vlanIdNum);
    
    if (!vlan) {
      return res.status(404).json({ error: 'VLAN not found' });
    }
    
    // Find all ports that are members of this VLAN
    const ports = switchData.ports.filter(port => {
      // Port is a member if it's untagged on this VLAN or has this VLAN in its tagged list
      return port.vlan === vlanIdNum || 
             (port.taggedVlans && port.taggedVlans.includes(vlanIdNum));
    });
    
    res.json(ports);
  } catch (error) {
    logger.error(`Error fetching ports for VLAN ${req.params.vlanId} on switch ${req.params.switchId}:`, error);
    res.status(500).json({ error: 'Failed to fetch VLAN ports' });
  }
});

export default router;
