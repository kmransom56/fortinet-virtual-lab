import EventEmitter from 'events';
import config from '../../config/config.js';
import logger from '../utils/logger.js';
import persistenceService from './persistence.service.js';

// Traffic patterns
const TRAFFIC_PATTERNS = {
  NONE: 'none',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  BURST: 'burst',
  CUSTOM: 'custom'
};

// Traffic types
const TRAFFIC_TYPES = {
  TCP: 'tcp',
  UDP: 'udp',
  ICMP: 'icmp',
  BROADCAST: 'broadcast',
  MULTICAST: 'multicast'
};

// Traffic Service
class TrafficService extends EventEmitter {
  constructor() {
    super();
    this.trafficGenerators = new Map(); // switchId -> intervalId
    this.trafficStats = new Map();      // switchId -> stats
    this.trafficPatterns = new Map();   // switchId -> pattern
    this.isRunning = false;
  }

  // Initialize traffic service
  async initialize(io) {
    this.io = io;
    const state = await persistenceService.getState();
    
    // Initialize traffic for each switch
    for (const switchData of state.switches) {
      this.initializeSwitch(switchData.id);
    }
    
    // Start with default traffic pattern
    this.setTrafficPattern(TRAFFIC_PATTERNS.MEDIUM);
    
    logger.info('Traffic service initialized');
  }

  // Initialize traffic for a switch
  initializeSwitch(switchId) {
    // Initialize traffic statistics
    this.trafficStats.set(switchId, {
      totalPackets: 0,
      totalBytes: 0,
      packetRate: 0,
      byteRate: 0,
      lastUpdate: Date.now(),
      interfaces: {}
    });
    
    // Set default traffic pattern
    this.trafficPatterns.set(switchId, TRAFFIC_PATTERNS.MEDIUM);
    
    logger.debug(`Traffic monitoring initialized for switch ${switchId}`);
  }

  // Set traffic pattern for all switches
  setTrafficPattern(pattern, options = {}) {
    if (!Object.values(TRAFFIC_PATTERNS).includes(pattern)) {
      throw new Error(`Invalid traffic pattern: ${pattern}`);
    }
    
    // Stop any existing traffic generators
    this.stopAllTraffic();
    
    // Set pattern for all switches
    for (const switchId of this.trafficStats.keys()) {
      this.trafficPatterns.set(switchId, pattern);
    }
    
    // Start traffic generation based on pattern
    switch (pattern) {
      case TRAFFIC_PATTERNS.NONE:
        // No traffic generation
        break;
        
      case TRAFFIC_PATTERNS.LOW:
        this.startTraffic(1000, 500, 100); // 1 packet per second, 500 bytes avg, 100 bytes std dev
        break;
        
      case TRAFFIC_PATTERNS.MEDIUM:
        this.startTraffic(100, 1000, 200); // 10 packets per second, 1KB avg, 200 bytes std dev
        break;
        
      case TRAFFIC_PATTERNS.HIGH:
        this.startTraffic(10, 1500, 500); // 100 packets per second, 1.5KB avg, 500 bytes std dev
        break;
        
      case TRAFFIC_PATTERNS.BURST:
        // Burst traffic: 1 second of high traffic every 10 seconds
        setInterval(() => {
          this.startTraffic(1, 2000, 1000); // 1000 packets in 1 second, 2KB avg, 1KB std dev
          setTimeout(() => this.stopAllTraffic(), 1000);
        }, 10000);
        break;
        
      case TRAFFIC_PATTERNS.CUSTOM:
        // Custom traffic pattern based on options
        const {
          interval = 100,      // ms between packets
          minSize = 64,        // minimum packet size
          maxSize = 1518,      // maximum packet size
          burstCount = 1,      // number of packets per interval
          burstInterval = 1000 // ms between bursts
        } = options;
        
        this.startTraffic(interval, (minSize + maxSize) / 2, (maxSize - minSize) / 6, {
          minSize,
          maxSize,
          burstCount,
          burstInterval
        });
        break;
    }
    
    logger.info(`Traffic pattern set to: ${pattern}`, options);
  }

  // Start traffic generation
  startTraffic(baseInterval, meanSize, stdDevSize, options = {}) {
    if (this.isRunning) return;
    
    const {
      minSize = 64,
      maxSize = 1518,
      burstCount = 1,
      burstInterval = 1000
    } = options;
    
    this.isRunning = true;
    let lastBurstTime = Date.now();
    let packetsInBurst = 0;
    
    const generateTraffic = () => {
      if (!this.isRunning) return;
      
      const now = Date.now();
      
      // Check if we should start a new burst
      if (now - lastBurstTime >= burstInterval) {
        packetsInBurst = 0;
        lastBurstTime = now;
      }
      
      // Generate traffic for each switch
      for (const [switchId, stats] of this.trafficStats.entries()) {
        const state = persistenceService.getState();
        const switchData = state.switches.find(s => s.id === switchId);
        
        if (!switchData || !switchData.ports) continue;
        
        // Update stats for each port
        for (const port of switchData.ports) {
          if (port.status !== 'up') continue;
          
          // Only process a subset of ports in each interval
          if (Math.random() > 0.3) continue;
          
          // Generate packet size with normal distribution
          let packetSize = Math.floor(
            Math.min(
              Math.max(
                this.normalRandom(meanSize, stdDevSize),
                minSize
              ),
              maxSize
            )
          );
          
          // Update statistics
          this.updateStats(switchId, port.id, packetSize);
          
          // Emit traffic event
          this.emitTraffic(switchId, port.id, packetSize);
          
          packetsInBurst++;
          
          // Check if we've reached the burst limit
          if (packetsInBurst >= burstCount && burstCount > 0) {
            break;
          }
        }
      }
      
      // Schedule next traffic generation
      if (this.isRunning) {
        const jitter = (Math.random() - 0.5) * baseInterval * 0.2; // ±10% jitter
        const nextInterval = Math.max(10, baseInterval + jitter);
        
        this.trafficTimer = setTimeout(generateTraffic, nextInterval);
      }
    };
    
    // Start the first traffic generation
    generateTraffic();
    
    logger.debug('Traffic generation started', {
      baseInterval,
      meanSize,
      stdDevSize,
      options
    });
  }

  // Stop all traffic generation
  stopAllTraffic() {
    this.isRunning = false;
    
    if (this.trafficTimer) {
      clearTimeout(this.trafficTimer);
      this.trafficTimer = null;
    }
    
    logger.debug('All traffic generation stopped');
  }

  // Update traffic statistics
  updateStats(switchId, portId, packetSize) {
    const now = Date.now();
    const stats = this.trafficStats.get(switchId) || {
      totalPackets: 0,
      totalBytes: 0,
      packetRate: 0,
      byteRate: 0,
      lastUpdate: now,
      interfaces: {}
    };
    
    // Initialize port stats if needed
    if (!stats.interfaces[portId]) {
      stats.interfaces[portId] = {
        totalPackets: 0,
        totalBytes: 0,
        packetRate: 0,
        byteRate: 0,
        lastUpdate: now,
        history: []
      };
    }
    
    const portStats = stats.interfaces[portId];
    
    // Update packet and byte counts
    portStats.totalPackets++;
    portStats.totalBytes += packetSize;
    stats.totalPackets++;
    stats.totalBytes += packetSize;
    
    // Calculate rates (packets/bytes per second)
    const timeDelta = (now - portStats.lastUpdate) / 1000; // in seconds
    
    if (timeDelta > 0) {
      // Update port rates
      portStats.packetRate = 1 / timeDelta;
      portStats.byteRate = packetSize / timeDelta;
      portStats.lastUpdate = now;
      
      // Update switch rates (exponential moving average)
      const alpha = 0.2; // Smoothing factor
      stats.packetRate = alpha * portStats.packetRate + (1 - alpha) * (stats.packetRate || 0);
      stats.byteRate = alpha * portStats.byteRate + (1 - alpha) * (stats.byteRate || 0);
      stats.lastUpdate = now;
      
      // Keep history (last 60 seconds)
      portStats.history.push({
        timestamp: now,
        packetRate: portStats.packetRate,
        byteRate: portStats.byteRate
      });
      
      // Trim history
      const maxHistory = 60; // 60 data points (1 minute at 1 second intervals)
      if (portStats.history.length > maxHistory) {
        portStats.history = portStats.history.slice(-maxHistory);
      }
    }
    
    // Update the stats in the map
    this.trafficStats.set(switchId, stats);
    
    // Emit stats update event
    this.emit('statsUpdate', { switchId, portId, stats: portStats });
    
    // Notify via WebSocket
    if (this.io) {
      this.io.to(`switch:${switchId}`).emit('traffic:stats', {
        switchId,
        portId,
        stats: portStats,
        timestamp: now
      });
    }
  }

  // Emit traffic event (for logging and monitoring)
  emitTraffic(switchId, portId, packetSize) {
    const event = {
      switchId,
      portId,
      packetSize,
      timestamp: Date.now(),
      trafficType: this.getRandomTrafficType()
    };
    
    // Emit the event
    this.emit('traffic', event);
    
    // Log sample traffic (1% of packets)
    if (Math.random() < 0.01) {
      logger.debug('Traffic generated', event);
    }
  }

  // Get traffic statistics for a switch or port
  getTrafficStats(switchId, portId = null) {
    const stats = this.trafficStats.get(switchId);
    
    if (!stats) {
      return null;
    }
    
    if (portId) {
      return stats.interfaces[portId] || null;
    }
    
    // Return aggregate stats for the switch
    return {
      totalPackets: stats.totalPackets,
      totalBytes: stats.totalBytes,
      packetRate: stats.packetRate,
      byteRate: stats.byteRate,
      lastUpdate: stats.lastUpdate,
      interfaceCount: Object.keys(stats.interfaces).length
    };
  }

  // Get a random traffic type
  getRandomTrafficType() {
    const types = Object.values(TRAFFIC_TYPES);
    return types[Math.floor(Math.random() * types.length)];
  }

  // Generate a random number with normal distribution (Box-Muller transform)
  normalRandom(mean, stdDev) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    
    const normal = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + stdDev * normal;
  }

  // Clean up resources
  shutdown() {
    this.stopAllTraffic();
    this.trafficStats.clear();
    this.trafficPatterns.clear();
    this.removeAllListeners();
    
    logger.info('Traffic service shut down');
  }
}

// Create and export singleton instance
const trafficService = new TrafficService();

export function setupTrafficGenerator(io) {
  return trafficService.initialize(io);
}

export function getTrafficStats(switchId, portId = null) {
  return trafficService.getTrafficStats(switchId, portId);
}

export function setTrafficPattern(pattern, options) {
  return trafficService.setTrafficPattern(pattern, options);
}

export async function shutdownTrafficGenerator() {
  return trafficService.shutdown();
}

export {
  TRAFFIC_PATTERNS,
  TRAFFIC_TYPES
};

export default trafficService;
