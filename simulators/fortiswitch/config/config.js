// Default configuration for the FortiSwitch simulator
export default {
  // Server configuration
  server: {
    port: process.env.PORT || 8081,
    host: '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  
  // Authentication & Security
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'fortiswitch-simulator-secret',
    apiKeys: process.env.API_KEYS ? process.env.API_KEYS.split(',') : ['default-api-key'],
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    },
  },
  
  // Persistence
  persistence: {
    enabled: process.env.PERSISTENCE_ENABLED !== 'false',
    filePath: process.env.PERSISTENCE_FILE || './data/fortiswitch-state.json',
    autoSaveInterval: process.env.AUTO_SAVE_INTERVAL || 30000, // 30 seconds
  },
  
  // SNMP Configuration
  snmp: {
    enabled: process.env.SNMP_ENABLED === 'true',
    port: process.env.SNMP_PORT || 161,
    community: process.env.SNMP_COMMUNITY || 'public',
    sysContact: process.env.SNMP_SYSCONTACT || 'admin@example.com',
    sysName: process.env.SNMP_SYSNAME || 'FortiSwitch-Simulator',
    sysLocation: process.env.SNMP_SYSLOCATION || 'Virtual Lab',
  },
  
  // Syslog Configuration
  syslog: {
    enabled: process.env.SYSLOG_ENABLED === 'true',
    host: process.env.SYSLOG_HOST || 'localhost',
    port: process.env.SYSLOG_PORT || 514,
    protocol: process.env.SYSLOG_PROTOCOL || 'udp',
    appName: process.env.SYSLOG_APP_NAME || 'fortiswitch-sim',
    facility: process.env.SYSLOG_FACILITY || 'local0',
  },
  
  // NetFlow Configuration
  netflow: {
    enabled: process.env.NETFLOW_ENABLED === 'true',
    port: process.env.NETFLOW_PORT || 2055,
    templateRefresh: process.env.NETFLOW_TEMPLATE_REFRESH || 20, // packets
  },
  
  // STP Configuration
  stp: {
    enabled: process.env.STP_ENABLED === 'true',
    bridgePriority: process.env.STP_BRIDGE_PRIORITY || 32768,
    helloTime: process.env.STP_HELLO_TIME || 2, // seconds
    maxAge: process.env.STP_MAX_AGE || 20, // seconds
    forwardDelay: process.env.STP_FORWARD_DELAY || 15, // seconds
  },
  
  // Traffic Generation
  traffic: {
    enabled: process.env.TRAFFIC_ENABLED === 'true',
    minPacketSize: process.env.TRAFFIC_MIN_PACKET_SIZE || 64,
    maxPacketSize: process.env.TRAFFIC_MAX_PACKET_SIZE || 1518,
    packetsPerSecond: process.env.TRAFFIC_PPS || 100,
  },
};
