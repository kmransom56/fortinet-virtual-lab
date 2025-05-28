# Fortinet Virtual Lab Architecture

## Overview

The Fortinet Virtual Lab is a comprehensive simulation environment designed to mirror a real-world network infrastructure for three restaurant brands: Arby's, Buffalo Wild Wings, and Sonic. This virtual lab enables testing, training, and development without requiring physical hardware.

## System Components

### 1. EVE-NG Integration

- **EVE-NG Platform**: Hosts the virtual FortiGate appliances
- **Brand-specific Topologies**:
  - Arby's network (arbys.unl)
  - Buffalo Wild Wings network (bww.unl)
  - Sonic network (sonic.unl)
- **FortiGate Virtual Machines**: One per brand, simulating the edge firewall

### 2. Docker-based Simulators

- **FortiSwitch Simulator**: Emulates FortiSwitch devices with API endpoints
- **FortiAP Simulator**: Emulates FortiAP wireless access points with API endpoints
- **Meraki Simulator**: Emulates Cisco Meraki switches used in Arby's and Buffalo Wild Wings
- **FortiManager Simulator**: Simulates FortiManager centralized management
- **FortiAnalyzer Simulator**: Simulates FortiAnalyzer logging and analytics

### 3. Management Interface

- **Web UI**: Central dashboard for controlling all lab components
- **EVE-NG Proxy**: API bridge between the web UI and EVE-NG

## Network Topology

### Arby's and Buffalo Wild Wings Topology

```
┌──────────────┐     ┌────────────┐
│   FortiGate  │────▶│ FortiManager│
└──────┬───────┘     └────────────┘
       │                    ▲
       ▼                    │
┌──────────────┐     ┌────────────┐
│ Meraki Switch │────▶│FortiAnalyzer│
└──────┬───────┘     └────────────┘
       │
       ▼
┌──────────────┐
│   FortiAP    │
└──────────────┘
```

### Sonic Topology

```
┌──────────────┐     ┌────────────┐
│   FortiGate  │────▶│ FortiManager│
└──────┬───────┘     └────────────┘
       │                    ▲
       ▼                    │
┌──────────────┐     ┌────────────┐
│ FortiSwitch  │────▶│FortiAnalyzer│
└──────┬───────┘     └────────────┘
       │
       ▼
┌──────────────┐
│   FortiAP    │
└──────────────┘
```

## Implementation Details

### 1. Device Simulators

All device simulators are implemented as Node.js services that:
- Expose REST APIs matching the actual device APIs
- Maintain realistic state information
- Respond to configuration changes
- Store persistent data to simulate device memory

### 2. EVE-NG Integration

The lab uses EVE-NG to run actual FortiGate VM images, providing:
- Realistic FortiOS experience
- Full configuration capabilities
- Network interface simulation
- Virtual machine state persistence

### 3. Containerization

The entire solution is containerized using Docker:
- Each simulator runs in its own container
- Docker Compose orchestrates the container ecosystem
- Volume mounts ensure data persistence
- Network configuration enables inter-container communication

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Access to an EVE-NG instance with FortiGate VM images
- Network connectivity to the EVE-NG server

### Deployment

1. Clone the repository
2. Copy `.env.example` to `.env` and configure your environment variables
3. Run `./scripts/start-lab.sh` to launch the lab environment
4. Access the web UI at http://localhost

## Security Considerations

- The lab is intended for internal use only
- Default credentials are used for simplicity but should be changed in production
- API keys and credentials are stored in the `.env` file
- Communication between containers is not encrypted by default

## Extension Points

The virtual lab can be extended in several ways:

1. **Additional Brands**: New brand topologies can be added to EVE-NG
2. **More Device Types**: New device simulators can be added as Docker containers
3. **Enhanced Scenarios**: Complex network scenarios can be configured
4. **Integration with CI/CD**: Automated testing can be implemented using the lab APIs
