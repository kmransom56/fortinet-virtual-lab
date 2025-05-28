# EVE-NG Topology Setup Guide

This document explains how to set up and configure the EVE-NG topology files for each brand in the Fortinet Virtual Lab environment.

## Overview

The Fortinet Virtual Lab includes pre-configured EVE-NG topology files for each brand:

- `arbys.unl` - Arby's network topology
- `bww.unl` - Buffalo Wild Wings network topology
- `sonic.unl` - Sonic network topology

These files define the network structure, devices, and connections for each brand's environment.

## Topology Specifications

### Common Elements

All three brand topologies include the following elements:

- FortiGate firewall
- FortiManager for centralized management
- Access to shared FortiAnalyzer
- Internal, DMZ, and WiFi networks
- Management network

### Brand-Specific Elements

**Arby's and Buffalo Wild Wings**
- Meraki switches for internal network
- FortiAP devices for WiFi network

**Sonic**
- FortiSwitches for internal network
- FortiAP devices for WiFi network

## Importing Topology Files

### Prerequisites

1. EVE-NG Professional installed and running
2. VM images imported according to the [EVE-NG Import Guide](eve-ng-import.md)

### Step 1: Transfer Topology Files to EVE-NG

Transfer the topology files to your EVE-NG server:

```bash
scp eve-ng-topology/*.unl root@eve-ng-server-ip:/opt/unetlab/tmp/
```

### Step 2: Import Topologies in EVE-NG

1. Login to EVE-NG web interface
2. Create a new folder called "Fortinet Virtual Lab"
3. Inside this folder, create separate folders for each brand ("Arby's", "Buffalo Wild Wings", "Sonic")
4. Import the corresponding .unl file into each folder:
   - From the EVE-NG web interface, click "Import" 
   - Select the appropriate .unl file from the /opt/unetlab/tmp/ directory

Alternatively, you can import the files using the CLI:

```bash
# On the EVE-NG server
mkdir -p /opt/unetlab/labs/Fortinet\ Virtual\ Lab/Arbys
mkdir -p /opt/unetlab/labs/Fortinet\ Virtual\ Lab/BWW
mkdir -p /opt/unetlab/labs/Fortinet\ Virtual\ Lab/Sonic

# Move the .unl files to the appropriate directories
mv /opt/unetlab/tmp/arbys.unl /opt/unetlab/labs/Fortinet\ Virtual\ Lab/Arbys/
mv /opt/unetlab/tmp/bww.unl /opt/unetlab/labs/Fortinet\ Virtual\ Lab/BWW/
mv /opt/unetlab/tmp/sonic.unl /opt/unetlab/labs/Fortinet\ Virtual\ Lab/Sonic/

# Fix permissions
/opt/unetlab/wrappers/unl_wrapper -a fixpermissions
```

## Topology Configurations

### Arby's Network (arbys.unl)

```
+---------------------+
|                     |
|    Internet         |
|                     |
+----------+----------+
           |
           |
+----------v----------+
|                     |
|    FortiGate        |
|                     |
+-----+------+-------+
      |      |       |
      |      |       |
+-----v--+ +-v----+ +v------+
|        | |      | |       |
| Internal| | DMZ  | | WiFi |
|        | |      | |       |
+----+---+ +------+ +---+---+
     |                  |
     |                  |
+----v---+          +---v---+
|        |          |       |
| Meraki |          |FortiAP|
|Switches|          |       |
+--------+          +-------+
```

- **FortiGate**: Firewall providing security services
- **Meraki Switches**: Two Meraki virtual switches in the internal network
- **FortiAP**: Three FortiAP virtual access points in the WiFi network
- **FortiManager**: Centralized management (connected to Management network)

### Buffalo Wild Wings Network (bww.unl)

Similar to Arby's network with specific configurations for BWW:

- **FortiGate**: Configured with BWW-specific policies and VLANs
- **Meraki Switches**: Two Meraki virtual switches with BWW configurations
- **FortiAP**: Three FortiAP virtual access points with BWW SSIDs
- **FortiManager**: Centralized management for BWW devices

### Sonic Network (sonic.unl)

```
+---------------------+
|                     |
|    Internet         |
|                     |
+----------+----------+
           |
           |
+----------v----------+
|                     |
|    FortiGate        |
|                     |
+-----+------+-------+
      |      |       |
      |      |       |
+-----v--+ +-v----+ +v------+
|        | |      | |       |
| Internal| | DMZ  | | WiFi |
|        | |      | |       |
+----+---+ +------+ +---+---+
     |                  |
     |                  |
+----v----+         +---v---+
|         |         |       |
| FortiSwitch        |FortiAP|
|         |         |       |
+---------+         +-------+
```

- **FortiGate**: Firewall with Sonic-specific configurations
- **FortiSwitches**: Two FortiSwitch virtual switches in the internal network
- **FortiAP**: Three FortiAP virtual access points in the WiFi network
- **FortiManager**: Centralized management for Sonic devices

## Device Configuration

### Initial Access

After importing the topologies and starting the networks, you can access the devices with the following default credentials:

- **FortiGate**: 
  - Username: admin
  - Password: (blank)
  - Web UI: https://[device-ip]
  
- **FortiManager**:
  - Username: admin
  - Password: (blank)
  - Web UI: https://[device-ip]

- **FortiAnalyzer**:
  - Username: admin
  - Password: (blank)
  - Web UI: https://[device-ip]

### Loading Configurations

You can load pre-configured settings for each device using the web UI or CLI:

#### FortiGate Configuration

1. Access the FortiGate web UI
2. Go to System > Configuration > Backup
3. Click "Restore"
4. Upload the appropriate configuration file from the `configs/` directory

Or via CLI:

```
exec restore config tftp [config-file] [tftp-server-ip]
```

#### FortiManager Configuration

1. Access the FortiManager web UI
2. Go to System Settings > Dashboard
3. Click "Backup" in the System Information widget
4. Select "Restore"
5. Upload the appropriate configuration file

## Integration with Simulators

The EVE-NG topologies are designed to work with the Docker-based simulators:

1. FortiSwitch Simulator - Simulates FortiSwitch devices for Sonic
2. FortiAP Simulator - Simulates FortiAP devices for all brands
3. Meraki Simulator - Simulates Meraki switches for Arby's and BWW

The simulators communicate with the virtual devices through the API Gateway, which routes requests to the appropriate endpoints.

## Troubleshooting

### Network Connectivity Issues

If devices cannot communicate with each other:

1. Check the network interfaces are correctly assigned in EVE-NG
2. Verify IP addressing is correct according to the topology
3. Ensure the EVE-NG cloud connector is properly configured

### Device Access Issues

If you cannot access device management interfaces:

1. Verify the device is powered on in EVE-NG
2. Check if the management interface has an IP address
3. Try accessing via both HTTPS and SSH
4. Reset the device if credentials are unknown

### Integration Issues

If simulators cannot communicate with the EVE-NG devices:

1. Check the API Gateway configuration
2. Verify network connectivity between Docker containers and EVE-NG
3. Check the EVE-NG Connector logs for connection errors

## Next Steps

After setting up the EVE-NG topologies:

1. Configure the FortiManager to manage the FortiGate devices
2. Set up FortiAnalyzer to collect logs from all devices
3. Configure the management UI to control the lab environment
4. Test device connectivity and security policies

For details on the overall system architecture, refer to the [Architecture Documentation](architecture.md).