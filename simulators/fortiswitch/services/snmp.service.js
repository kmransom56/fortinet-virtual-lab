import snmp from 'net-snmp';
import config from '../../config/config.js';
import logger from '../utils/logger.js';
import persistenceService from './persistence.service.js';

// SNMP MIB OIDs
const OIDS = {
  // System group
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysObjectID: '1.3.6.1.2.1.1.2.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysContact: '1.3.6.1.2.1.1.4.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysLocation: '1.3.6.1.2.1.1.6.0',
  
  // Interfaces group
  ifNumber: '1.3.6.1.2.1.2.1.0',
  
  // FortiSwitch specific OIDs
  fswSystemModel: '1.3.6.1.4.1.12356.102.3.1.1.0',
  fswSystemSerial: '1.3.6.1.4.1.12356.102.3.1.2.0',
  fswSystemFirmware: '1.3.6.1.4.1.12356.102.3.1.3.0',
};

// SNMP agent instance
let snmpAgent = null;

// Initialize SNMP server
export async function initializeSNMPServer() {
  return new Promise((resolve, reject) => {
    try {
      // Create SNMP agent
      snmpAgent = snmp.createAgent({
        port: config.snmp.port,
        disableAuthorization: false,
        accessControlListType: 1, // Allow any host
        accessList: [
          {
            oid: '1.3.6',
            community: config.snmp.community,
            access: 2 // READ_ONLY
          }
        ]
      });
      
      // Register OID handlers
      registerOIDHandlers();
      
      // Start the agent
      snmpAgent.bind(() => {
        logger.info(`SNMP agent bound to port ${config.snmp.port}`);
        resolve();
      });
      
      // Handle errors
      snmpAgent.on('error', (error) => {
        logger.error('SNMP agent error:', error);
        reject(error);
      });
      
    } catch (error) {
      logger.error('Failed to initialize SNMP agent:', error);
      reject(error);
    }
  });
}

// Register OID handlers
function registerOIDHandlers() {
  // System group
  snmpAgent.getHandler = new snmp.Mib();
  
  // System description
  snmpAgent.getHandler.addSubtree(OIDS.sysDescr, new snmp.MibNode(
    snmp.data.octetString, (varbind) => {
      varbind.value = 'FortiSwitch Simulator';
    })
  );
  
  // System object ID
  snmpAgent.getHandler.addSubtree(OIDS.sysObjectID, new snmp.MibNode(
    snmp.data.oid, (varbind) => {
      varbind.value = '1.3.6.1.4.1.12356.102.999';
    })
  );
  
  // System uptime (in hundredths of a second)
  snmpAgent.getHandler.addSubtree(OIDS.sysUpTime, new snmp.MibNode(
    snmp.data.timeticks, (varbind) => {
      // Return uptime in hundredths of a second (e.g., 1 day = 8640000)
      varbind.value = Math.floor(process.uptime() * 100) % 2147483647;
    })
  );
  
  // System contact
  snmpAgent.getHandler.addSubtree(OIDS.sysContact, new snmp.MibNode(
    snmp.data.octetString, (varbind) => {
      varbind.value = config.snmp.sysContact;
    })
  );
  
  // System name
  snmpAgent.getHandler.addSubtree(OIDS.sysName, new snmp.MibNode(
    snmp.data.octetString, (varbind) => {
      varbind.value = config.snmp.sysName;
    })
  );
  
  // System location
  snmpAgent.getHandler.addSubtree(OIDS.sysLocation, new snmp.MibNode(
    snmp.data.octetString, (varbind) => {
      varbind.value = config.snmp.sysLocation;
    })
  );
  
  // Number of network interfaces
  snmpAgent.getHandler.addSubtree(OIDS.ifNumber, new snmp.MibNode(
    snmp.data.integer, (varbind) => {
      const state = persistenceService.getState();
      let portCount = 0;
      
      // Count all ports across all switches
      state.switches.forEach(switchData => {
        portCount += switchData.ports?.length || 0;
      });
      
      varbind.value = portCount || 48; // Default to 48 if no switches
    })
  );
  
  // FortiSwitch model
  snmpAgent.getHandler.addSubtree(OIDS.fswSystemModel, new snmp.MibNode(
    snmp.data.octetString, (varbind) => {
      varbind.value = 'FortiSwitch-448D-FPOE';
    })
  );
  
  // FortiSwitch serial number
  snmpAgent.getHandler.addSubtree(OIDS.fswSystemSerial, new snmp.MibNode(
    snmp.data.octetString, (varbind) => {
      varbind.value = 'FSW' + Math.random().toString(36).substring(2, 10).toUpperCase();
    })
  );
  
  // FortiSwitch firmware version
  snmpAgent.getHandler.addSubtree(OIDS.fswSystemFirmware, new snmp.MibNode(
    snmp.data.octetString, (varbind) => {
      varbind.value = 'v7.2.3,build1234,220420 (GA)';
    })
  );
}

// Close SNMP server
export function closeSNMPServer() {
  if (snmpAgent) {
    snmpAgent.close();
    snmpAgent = null;
    logger.info('SNMP server closed');
  }
}

export default {
  initializeSNMPServer,
  closeSNMPServer
};
