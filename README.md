# Fortinet Virtual Lab Environment

A complete virtual lab environment that mirrors the network infrastructure for Arby's, Buffalo Wild Wings, and Sonic brands, featuring Fortinet security products and Meraki networking equipment.

![Fortinet Virtual Lab](https://via.placeholder.com/800x400?text=Fortinet+Virtual+Lab)

## Overview

This project creates a comprehensive virtual lab environment that simulates the complete network infrastructure for three restaurant brands - Arby's, Buffalo Wild Wings, and Sonic. The lab environment includes virtualized FortiGate firewalls, FortiManager centralized management, FortiAnalyzer logging, and virtualized network devices including FortiSwitches, FortiAPs, and Meraki switches.

The entire environment is containerized and easily deployable, designed specifically for non-technical users to spin up a realistic network environment without deep knowledge of Docker, virtualization, or networking.

## Features

- **Brand-Specific Network Environments**
  - Arby's: FortiGate firewalls, Meraki switches, FortiAPs
  - Buffalo Wild Wings: FortiGate firewalls, Meraki switches, FortiAPs
  - Sonic: FortiGate firewalls, FortiSwitches, FortiAPs

- **Management Infrastructure**
  - FortiManager for each brand
  - Shared FortiAnalyzer for logging
  - Web-based management portal

- **Simulators for Network Devices**
  - FortiSwitch simulator with realistic API responses
  - FortiAP simulator with configurable behavior
  - Meraki switch simulator with dashboard API

- **Automation and Ease of Use**
  - Docker containerization for easy deployment
  - One-click brand environment activation
  - Pre-configured network topologies

## System Architecture

The system is built using the following technologies:

- **EVE-NG Professional** - Core virtualization platform for Fortinet VMs
- **Docker** and **Kubernetes** - Container platforms for simulators and web UI
- **Node.js** - Backend for API simulators
- **React.js** - Frontend for web management interface

## Getting Started

### Prerequisites

- Server with minimum 32GB RAM, 8+ CPU cores, 500GB storage
- Virtualization support (Intel VT-x/AMD-V)
- Docker and Docker Compose
- Kubernetes cluster (for production deployment)
- FortiGate, FortiManager, and FortiAnalyzer VM images

### Quick Start with Docker Compose

1. Clone this repository:

```bash
git clone https://github.com/kmransom56/fortinet-virtual-lab.git
cd fortinet-virtual-lab
```

2. Configure environment variables (optional):

```bash
cp .env.example .env
# Edit .env file to customize settings
```

3. Start the environment:

```bash
./scripts/start-lab.sh
```

4. Access the web management interface at http://localhost:8080

### Production Deployment with Kubernetes

For production environments, we recommend using Kubernetes:

1. Configure your Kubernetes context:

```bash
kubectl config use-context your-cluster-context
```

2. Deploy the application:

```bash
kubectl apply -f kubernetes/production/
```

3. Access the application using the configured Ingress host.

## Project Structure

```
/fortinet-virtual-lab/
├── README.md                   # Project overview
├── docker-compose.yml          # Container orchestration
├── .github/                    # GitHub workflows for CI/CD
├── configs/                    # Configuration templates
│   └── fortigate-sample.conf   # FortiGate configuration
├── docs/                       # Documentation
│   └── architecture.md         # Architecture diagrams
├── eve-ng-topology/            # EVE-NG network topologies
│   ├── arbys.unl               # Arby's network
│   ├── bww.unl                 # Buffalo Wild Wings network
│   └── sonic.unl               # Sonic network
├── kubernetes/                 # Kubernetes manifests
│   ├── staging/                # Staging environment
│   └── production/             # Production environment
├── scripts/                    # Management scripts
│   ├── start-lab.sh            # Lab startup script
│   └── stop-lab.sh             # Lab shutdown script
├── simulators/                 # API simulators
│   ├── fortiswitch/            # FortiSwitch simulator
│   ├── fortiap/                # FortiAP simulator
│   └── meraki/                 # Meraki switches simulator
└── ui/                         # Web management interface
```

## Contributing

We welcome contributions to the Fortinet Virtual Lab project! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Fortinet for their virtual appliance documentation
- Cisco Meraki for their API documentation
- EVE-NG for the network emulation platform

## Support

For support, please open an issue on the GitHub repository or contact the maintainers directly.