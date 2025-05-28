import EventEmitter from 'events';
import config from '../../config/config.js';
import logger from '../utils/logger.js';
import persistenceService from './persistence.service.js';

// STP Constants
const STP_STATES = {
  DISABLED: 'disabled',
  BLOCKING: 'blocking',
  LISTENING: 'listening',
  LEARNING: 'learning',
  FORWARDING: 'forwarding'
};

const STP_PORT_ROLES = {
  ROOT: 'root',
  DESIGNATED: 'designated',
  ALTERNATE: 'alternate',
  BACKUP: 'backup',
  DISABLED: 'disabled'
};

// STP Timer constants (in milliseconds)
const HELLO_TIME = 2000;       // 2 seconds
const FORWARD_DELAY = 15000;   // 15 seconds
const MAX_AGE = 20000;         // 20 seconds

// STP Service
class STPService extends EventEmitter {
  constructor() {
    super();
    this.stpInstances = new Map(); // switchId -> STP instance
    this.topologyChangeTimers = new Map();
    this.helloTimers = new Map();
  }

  // Initialize STP for all switches
  async initialize(io) {
    this.io = io;
    const state = await persistenceService.getState();
    
    // Initialize STP for each switch
    for (const switchData of state.switches) {
      await this.initializeSwitch(switchData.id);
    }
    
    // Listen for switch changes
    persistenceService.on('switch:updated', (switchData) => {
      this.handleSwitchUpdate(switchData);
    });
    
    logger.info('STP service initialized');
  }

  // Initialize STP for a single switch
  async initializeSwitch(switchId) {
    const state = await persistenceService.getState();
    const switchData = state.switches.find(s => s.id === switchId);
    
    if (!switchData) {
      logger.warn(`Switch ${switchId} not found for STP initialization`);
      return;
    }
    
    // Initialize STP state for this switch
    const stpState = {
      switchId: switchData.id,
      bridgeId: this.generateBridgeId(switchData),
      rootBridgeId: null,
      rootPathCost: 0,
      rootPort: null,
      maxAge: MAX_AGE,
      helloTime: HELLO_TIME,
      forwardDelay: FORWARD_DELAY,
      topologyChange: false,
      lastTopologyChange: null,
      ports: {}
    };
    
    // Initialize port states
    for (const port of switchData.ports || []) {
      stpState.ports[port.id] = this.initializePortState(port);
    }
    
    // Store the STP state
    this.stpInstances.set(switchId, stpState);
    
    // Start the STP process
    this.startSTP(switchId);
    
    logger.debug(`STP initialized for switch ${switchId}`, { bridgeId: stpState.bridgeId });
  }

  // Initialize STP state for a port
  initializePortState(port) {
    return {
      id: port.id,
      role: STP_PORT_ROLES.DESIGNATED,
      state: port.status === 'up' ? STP_STATES.FORWARDING : STP_STATES.DISABLED,
      pathCost: this.calculatePortCost(port),
      designatedBridge: null,
      designatedPort: null,
      messageAge: 0,
      lastBpdu: null
    };
  }

  // Start the STP process for a switch
  startSTP(switchId) {
    const stpState = this.stpInstances.get(switchId);
    if (!stpState) return;

    // Start sending BPDUs
    this.startHelloTimer(switchId);
    
    // Initialize as root bridge
    this.electRootBridge(switchId);
  }

  // Handle switch updates (e.g., port status changes)
  async handleSwitchUpdate(switchData) {
    const stpState = this.stpInstances.get(switchData.id);
    if (!stpState) return;

    let topologyChanged = false;
    
    // Update port states based on current switch configuration
    for (const port of switchData.ports || []) {
      const portState = stpState.ports[port.id];
      
      if (!portState) {
        // New port
        stpState.ports[port.id] = this.initializePortState(port);
        topologyChanged = true;
      } else if (portState.state === STP_STATES.DISABLED && port.status === 'up') {
        // Port came up
        portState.state = STP_STATES.BLOCKING;
        this.startPortStateMachine(switchData.id, port.id);
        topologyChanged = true;
      } else if (portState.state !== STP_STATES.DISABLED && port.status === 'down') {
        // Port went down
        portState.state = STP_STATES.DISABLED;
        topologyChanged = true;
      }
    }
    
    // Handle topology changes
    if (topologyChanged) {
      this.handleTopologyChange(switchData.id);
    }
  }

  // Elect root bridge (simplified)
  electRootBridge(switchId) {
    const stpState = this.stpInstances.get(switchId);
    if (!stpState) return;
    
    // In a real implementation, we would compare with other switches
    // For simulation, the first switch becomes the root
    if (switchId === 'SW001') {
      stpState.rootBridgeId = stpState.bridgeId;
      stpState.rootPathCost = 0;
      stpState.rootPort = null;
      
      // All ports become designated ports
      for (const portId in stpState.ports) {
        const port = stpState.ports[portId];
        if (port.state !== STP_STATES.DISABLED) {
          port.role = STP_PORT_ROLES.DESIGNATED;
          port.state = STP_STATES.FORWARDING;
        }
      }
      
      logger.info(`Switch ${switchId} elected as root bridge`, { bridgeId: stpState.bridgeId });
    } else {
      // Non-root bridge logic would go here
    }
  }

  // Handle topology changes
  handleTopologyChange(switchId) {
    // In a real implementation, we would run the STP algorithm here
    // For simulation, we'll just log the event and emit a notification
    
    this.emit('topologyChange', { switchId });
    
    // Notify clients via WebSocket
    if (this.io) {
      this.io.to(`switch:${switchId}`).emit('stp:topologyChange', {
        switchId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Set topology change flag and start timer to clear it
    const stpState = this.stpInstances.get(switchId);
    if (stpState) {
      stpState.topologyChange = true;
      stpState.lastTopologyChange = new Date();
      
      // Clear any existing timer
      if (this.topologyChangeTimers.has(switchId)) {
        clearTimeout(this.topologyChangeTimers.get(switchId));
      }
      
      // Set timer to clear topology change flag
      this.topologyChangeTimers.set(
        switchId,
        setTimeout(() => {
          if (stpState) {
            stpState.topologyChange = false;
            logger.debug(`Topology change cleared for switch ${switchId}`);
          }
        }, 30000) // 30 seconds
      );
    }
    
    logger.info(`Topology change detected on switch ${switchId}`);
  }

  // Start the port state machine
  startPortStateMachine(switchId, portId) {
    const stpState = this.stpInstances.get(switchId);
    if (!stpState) return;
    
    const port = stpState.ports[portId];
    if (!port || port.state === STP_STATES.DISABLED) return;
    
    // In a real implementation, we would implement the full STP state machine here
    // For simulation, we'll just transition through the states with delays
    
    if (port.state === STP_STATES.BLOCKING) {
      port.state = STP_STATES.LISTENING;
      
      setTimeout(() => {
        port.state = STP_STATES.LEARNING;
        
        setTimeout(() => {
          port.state = STP_STATES.FORWARDING;
          this.handleTopologyChange(switchId);
        }, this.forwardDelay / 2);
        
      }, this.forwardDelay / 2);
    }
  }

  // Start the hello timer for a switch
  startHelloTimer(switchId) {
    // Clear any existing timer
    this.stopHelloTimer(switchId);
    
    // Set new timer
    const timer = setInterval(() => {
      this.sendBPDUs(switchId);
    }, HELLO_TIME);
    
    this.helloTimers.set(switchId, timer);
  }
  
  // Stop the hello timer for a switch
  stopHelloTimer(switchId) {
    if (this.helloTimers.has(switchId)) {
      clearInterval(this.helloTimers.get(switchId));
      this.helloTimers.delete(switchId);
    }
  }

  // Send BPDUs (simplified)
  sendBPDUs(switchId) {
    const stpState = this.stpInstances.get(switchId);
    if (!stpState) return;
    
    // In a real implementation, we would send BPDUs to connected switches
    // For simulation, we'll just log the event
    logger.debug(`Sending BPDUs from switch ${switchId}`);
    
    // Notify clients via WebSocket
    if (this.io) {
      this.io.to(`switch:${switchId}`).emit('stp:bpduSent', {
        switchId,
        timestamp: new Date().toISOString(),
        rootBridgeId: stpState.rootBridgeId,
        rootPathCost: stpState.rootPathCost
      });
    }
  }

  // Generate a bridge ID from switch data
  generateBridgeId(switchData) {
    // In a real implementation, this would use the switch's MAC address
    // For simulation, we'll use a hash of the switch ID
    const hash = Array.from(switchData.id).reduce(
      (hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0
    );
    
    // Bridge ID format: <priority>.<MAC address>
    // Priority is 32768 by default (0x8000)
    const priority = 32768; // Default priority
    const mac = `00:00:00:${Math.abs(hash).toString(16).padStart(6, '0').match(/.{2}/g).join(':')}`;
    
    return `${priority}.${mac}`;
  }

  // Calculate port cost based on speed
  calculatePortCost(port) {
    // Standard STP path costs based on port speed
    const speed = port.speed || '1G';
    
    switch (speed) {
      case '10G': return 2;
      case '1G': return 4;
      case '100M': return 19;
      case '10M': return 100;
      default: return 4; // Default to 1G cost
    }
  }

  // Get STP status for a switch
  getSTPStatus(switchId) {
    const stpState = this.stpInstances.get(switchId);
    if (!stpState) return null;
    
    return {
      enabled: true,
      bridgeId: stpState.bridgeId,
      rootBridge: stpState.bridgeId === stpState.rootBridgeId,
      rootBridgeId: stpState.rootBridgeId,
      rootPort: stpState.rootPort,
      rootPathCost: stpState.rootPathCost,
      topologyChange: stpState.topologyChange,
      lastTopologyChange: stpState.lastTopologyChange,
      ports: Object.values(stpState.ports).map(port => ({
        id: port.id,
        role: port.role,
        state: port.state,
        pathCost: port.pathCost,
        designatedBridge: port.designatedBridge,
        designatedPort: port.designatedPort
      }))
    };
  }

  // Clean up resources
  async shutdown() {
    // Stop all timers
    for (const [switchId] of this.helloTimers) {
      this.stopHelloTimer(switchId);
    }
    
    for (const [switchId] of this.topologyChangeTimers) {
      clearTimeout(this.topologyChangeTimers.get(switchId));
    }
    
    this.helloTimers.clear();
    this.topologyChangeTimers.clear();
    this.stpInstances.clear();
    
    logger.info('STP service shut down');
  }
}

// Create and export singleton instance
const stpService = new STPService();

export function setupSTP(io) {
  return stpService.initialize(io);
}

export function getSTPStatus(switchId) {
  return stpService.getSTPStatus(switchId);
}

export async function shutdownSTP() {
  return stpService.shutdown();
}

export default stpService;
