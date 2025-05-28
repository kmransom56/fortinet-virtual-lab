# Fortinet Virtual Lab Web Interface

This directory contains the code for the web management interface of the Fortinet Virtual Lab environment. The UI is built with React and provides a comprehensive dashboard for controlling and monitoring the virtual lab environment.

## Features

- **Dashboard**: View system status, active devices, and resource utilization
- **Brand Selection**: One-click activation for Arby's, Buffalo Wild Wings, and Sonic environments
- **Network Topology Visualization**: Interactive network maps for each brand
- **Device Management**: Configure and monitor FortiGate, FortiManager, and FortiAnalyzer VMs
- **Simulator Controls**: Interface with FortiSwitch, FortiAP, and Meraki simulators
- **Configuration Management**: Import, export, and apply device configurations
- **Log Viewer**: Access and search FortiAnalyzer logs

## Technology Stack

- **React**: Frontend library for building the user interface
- **Redux**: State management
- **Material-UI**: Component library for consistent styling
- **D3.js**: Network topology visualization
- **Axios**: API communication
- **React Router**: Navigation and routing
- **Jest/React Testing Library**: Unit and integration tests

## Architecture

The UI follows a modular architecture with the following key components:

- **Core**: Base components, state management, and utilities
- **Auth**: Authentication and authorization logic
- **Dashboard**: Main dashboard views and widgets
- **Devices**: Device management interfaces
- **Topology**: Network visualization components
- **Configuration**: Configuration management tools
- **Logs**: Log viewing and analysis tools

## Development

### Prerequisites

- Node.js 16+ and npm
- Docker (for containerized development)

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The development server will start at http://localhost:3000 and will proxy API requests to the backend services.

### Building for Production

```bash
# Create production build
npm run build
```

### Docker Development

```bash
# Build the Docker image
docker build -t fortinet-lab-ui .

# Run the container
docker run -p 8080:80 fortinet-lab-ui
```

## Deployment

The UI is deployed as part of the overall Fortinet Virtual Lab environment. It can be deployed in two ways:

1. **Docker Compose**: For development and testing
2. **Kubernetes**: For production deployments

### Docker Compose Deployment

The UI is included in the root `docker-compose.yml` file and will be deployed automatically when running:

```bash
docker-compose up -d
```

### Kubernetes Deployment

Kubernetes manifests for the UI are located in the `kubernetes/` directory at the project root. Deploy with:

```bash
kubectl apply -f kubernetes/production/
```

## API Integration

The UI communicates with the following backend services:

- **API Gateway**: Central service that routes requests to appropriate backends
- **EVE-NG Connector**: Controls virtual machines in EVE-NG
- **Device Simulators**: FortiSwitch, FortiAP, and Meraki simulators

All API calls are authenticated and use HTTPS.

## Testing

```bash
# Run unit tests
npm test

# Run end-to-end tests
npm run test:e2e
```

## Directory Structure

```
/ui
├── Dockerfile           # Docker configuration
├── README.md            # This file
├── package.json         # Dependencies and scripts
├── public/              # Static assets
├── src/                 # Source code
│   ├── assets/          # Images, icons, etc.
│   ├── components/      # Reusable React components
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Page components
│   ├── services/        # API and other services
│   ├── store/           # Redux state management
│   ├── utils/           # Utility functions
│   ├── App.js           # Main application component
│   ├── index.js         # Application entry point
│   └── theme.js         # Material-UI theme configuration
└── tests/               # Test files
```

## Customization

The UI can be customized for specific deployment scenarios:

- **Branding**: Update logos and colors in `src/theme.js`
- **Features**: Enable/disable features in the environment variables
- **Layouts**: Modify dashboard layouts in the configuration files

## Related Documentation

- [Architecture Overview](../docs/architecture.md)
- [EVE-NG Integration](../docs/eve-ng-import.md)
- [EVE-NG Topology Setup](../docs/eve-ng-topology.md)