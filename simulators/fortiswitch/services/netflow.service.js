import netflow from 'node-netflowv9';
import config from '../../config/config.js';
import logger from '../utils/logger.js';
import persistenceService from './persistence.service.js';

// NetFlow collector instance
let netflowCollector = null;

// Initialize NetFlow server
export function initializeNetflowServer() {
  try {
    // Create NetFlow collector
    netflowCollector = netflow.createCollector({
      port: config.netflow.port || 2055,
      templateFlushTime: config.netflow.templateRefresh || 20,
      templateFlushPackets: 50,
      version: 9,
      logger: {
        info: (msg) => logger.debug(`[NetFlow] ${msg}`),
        warn: (msg) => logger.warn(`[NetFlow] ${msg}`),
        error: (msg) => logger.error(`[NetFlow] ${msg}`)
      }
    });

    // Handle NetFlow data
    netflowCollector.on('data', (flow) => {
      try {
        processFlowData(flow);
      } catch (error) {
        logger.error('Error processing NetFlow data:', error);
      }
    });

    netflowCollector.on('error', (error) => {
      logger.error('NetFlow collector error:', error);
    });

    netflowCollector.on('close', () => {
      logger.info('NetFlow collector closed');
    });

    logger.info(`NetFlow collector started on port ${config.netflow.port}`);
    return netflowCollector;
  } catch (error) {
    logger.error('Failed to initialize NetFlow collector:', error);
    throw error;
  }
}

// Process incoming flow data
function processFlowData(flow) {
  try {
    const { header, rinfo, payload } = flow;
    const flowData = {
      timestamp: new Date(),
      source: `${rinfo.address}:${rinfo.port}`,
      flowsetId: header.flowsetId,
      length: header.length,
      count: header.count,
      uptime: header.uptime,
      flows: []
    };

    // Process each flow in the payload
    if (payload && Array.isArray(payload)) {
      payload.forEach(flow => {
        const flowInfo = {
          srcAddr: flow.srcaddr,
          dstAddr: flow.dstaddr,
          srcPort: flow.srcport,
          dstPort: flow.dstport,
          protocol: flow.protocol,
          bytes: flow.bytes,
          packets: flow.packets,
          firstSwitched: flow.first,
          lastSwitched: flow.last,
          tcpFlags: flow.tcp_flags,
          tos: flow.tos,
          input: flow.input,
          output: flow.output
        };
        flowData.flows.push(flowInfo);
      });
    }

    // Log flow data (in production, you might want to store this in a database)
    logger.debug('NetFlow data received:', {
      source: flowData.source,
      flowCount: flowData.flows.length,
      bytes: flowData.flows.reduce((sum, f) => sum + (f.bytes || 0), 0)
    });

    // Update switch statistics
    updateSwitchStatistics(flowData);
    
    return flowData;
  } catch (error) {
    logger.error('Error processing flow data:', error);
    throw error;
  }
}

// Update switch statistics based on flow data
function updateSwitchStatistics(flowData) {
  try {
    const state = persistenceService.getState();
    
    // Update statistics for each switch
    state.switches.forEach(switchData => {
      if (!switchData.stats) {
        switchData.stats = {
          totalBytes: 0,
          totalPackets: 0,
          activeFlows: 0,
          portStats: {}
        };
      }
      
      // Update port statistics
      flowData.flows.forEach(flow => {
        // Find the switch port this flow belongs to
        const portId = flow.input || flow.output;
        if (portId && switchData.ports && switchData.ports[portId - 1]) {
          const port = switchData.ports[portId - 1];
          
          // Initialize port stats if needed
          if (!switchData.stats.portStats[portId]) {
            switchData.stats.portStats[portId] = {
              bytesIn: 0,
              bytesOut: 0,
              packetsIn: 0,
              packetsOut: 0,
              errors: 0,
              discards: 0
            };
          }
          
          // Update port statistics
          const portStats = switchData.stats.portStats[portId];
          if (flow.input === portId) {
            portStats.bytesIn += flow.bytes || 0;
            portStats.packetsIn += flow.packets || 0;
          } else {
            portStats.bytesOut += flow.bytes || 0;
            portStats.packetsOut += flow.packets || 0;
          }
          
          // Update total switch statistics
          switchData.stats.totalBytes += flow.bytes || 0;
          switchData.stats.totalPackets += flow.packets || 1;
          switchData.stats.activeFlows = Object.keys(switchData.stats.portStats).length;
        }
      });
    });
    
    // Save updated state
    persistenceService.updateState(state);
  } catch (error) {
    logger.error('Error updating switch statistics:', error);
  }
}

// Close NetFlow collector
export function closeNetflowServer() {
  if (netflowCollector) {
    netflowCollector.close();
    netflowCollector = null;
    logger.info('NetFlow collector closed');
  }
}

export default {
  initializeNetflowServer,
  closeNetflowServer
};
