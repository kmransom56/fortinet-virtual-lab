# Fortinet Virtual Lab

[![Build Status](https://img.shields.io/github/workflow/status/kmransom56/fortinet-virtual-lab/build-and-test)](https://github.com/kmransom56/fortinet-virtual-lab/actions)
[![License](https://img.shields.io/github/license/kmransom56/fortinet-virtual-lab)](LICENSE)

## Overview

The Fortinet Virtual Lab is a comprehensive simulation environment that creates a virtual mirror of Fortinet network infrastructure for three restaurant brands: Arby's, Buffalo Wild Wings, and Sonic. It combines Docker-based device simulators with EVE-NG virtual machines to provide a complete testing and training environment.

![Fortinet Virtual Lab Architecture](docs/images/architecture-diagram.png)

## Features

- **Multi-brand Virtual Network**: Simulate distinct network topologies for Arby's, Buffalo Wild Wings, and Sonic
- **Fortinet Device Simulation**: Virtual FortiGate, FortiManager, FortiAnalyzer, FortiSwitch, and FortiAP
- **Meraki Integration**: Simulate Meraki switches used in Arby's and Buffalo Wild Wings locations
- **EVE-NG Integration**: Run actual FortiGate VMs within EVE-NG platform
- **Centralized Management**: Web UI for controlling all lab components
- **API Access**: RESTful APIs for all simulated devices
- **Containerized Architecture**: Easy deployment with Docker Compose

## Prerequisites

- Docker and Docker Compose
- Access to an EVE-NG server with FortiGate VM images
- Network connectivity to the EVE-NG server
- Basic understanding of Fortinet products

## Quick Start

1. Clone this repository:

```bash
git clone https://github.com/kmransom56/fortinet-virtual-lab.git
cd fortinet-virtual-lab
```

2. Configure your environment:

```bash
cp .env.example .env
# Edit .env with your specific settings
vim .env
```

3. Start the lab environment:

```bash
chmod +x scripts/start-lab.sh
./scripts/start-lab.sh
```

4. Access the web UI at http://localhost

5. To stop the lab:

```bash
chmod +x scripts/stop-lab.sh
./scripts/stop-lab.sh
```

## Components

### Network Topology

The lab simulates three distinct network topologies:

- **Arby's**: FortiGate + Meraki Switches + FortiAP
- **Buffalo Wild Wings**: FortiGate + Meraki Switches + FortiAP
- **Sonic**: FortiGate + FortiSwitch + FortiAP

All brands share a common FortiManager and FortiAnalyzer for centralized management and logging.

### Docker Containers

- **fortiswitch-simulator**: API simulator for FortiSwitch devices
- **fortiap-simulator**: API simulator for FortiAP wireless access points
- **meraki-simulator**: API simulator for Cisco Meraki switches
- **fortimanager-simulator**: API simulator for FortiManager
- **fortianalyzer-simulator**: API simulator for FortiAnalyzer
- **eve-ng-proxy**: API bridge to EVE-NG platform
- **lab-ui**: Web interface for managing the lab

### EVE-NG Virtual Machines

- **FortiGate-Arbys**: FortiGate VM for Arby's network
- **FortiGate-BWW**: FortiGate VM for Buffalo Wild Wings network
- **FortiGate-Sonic**: FortiGate VM for Sonic network
- **FortiManager**: Central management VM
- **FortiAnalyzer**: Logging and analytics VM

## Configuration

### Environment Variables

Key configuration settings in `.env` file:

- EVE-NG connection parameters
- API credentials for all devices
- Path to EVE-NG lab files
- Web UI authentication

### Custom Configurations

To customize the lab for your specific needs:

1. Modify EVE-NG topology files in `/eve-ng-topology/`
2. Edit device configurations in `/configs/`
3. Update simulator behavior by modifying the server.js files

## API Access

All simulated devices expose RESTful APIs:

- FortiSwitch: http://localhost:3001/api
- FortiAP: http://localhost:3002/api
- Meraki: http://localhost:3003/api
- FortiManager: http://localhost:3004/api
- FortiAnalyzer: http://localhost:3005/api
- EVE-NG Proxy: http://localhost:3010/api

## Development

### Project Structure

```
├── api-proxy/           # EVE-NG API proxy
├── configs/             # Device configuration templates
├── docs/                # Documentation
├── eve-ng-topology/     # EVE-NG topology files
├── kubernetes/          # Kubernetes deployment files
├── scripts/             # Utility scripts
├── simulators/          # Device simulators
│   ├── fortiap/
│   ├── fortianalyzer/
│   ├── fortimanager/
│   ├── fortiswitch/
│   └── meraki/
├── ui/                  # Web UI
├── .env.example         # Environment variables template
├── docker-compose.yml   # Docker Compose configuration
└── README.md            # This file
```

### Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Fortinet for their API documentation
- Cisco Meraki for their API documentation
- EVE-NG for the network emulation platform
