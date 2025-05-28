# Fortinet Virtual Lab Web UI

Web-based management interface for the Fortinet Virtual Lab environment. This user interface is designed to provide a simple and intuitive way for non-technical users to interact with the virtual lab components.

## Features

- Dashboard with lab status overview
- One-click brand environment activation
- Visual network topology maps
- Direct links to device management interfaces
- Configuration backup and restore functionality
- Troubleshooting guides and help documentation

## Technology Stack

- React.js frontend
- REST API integration with EVE-NG and simulators
- Docker containerized deployment
- Nginx for serving static content and reverse proxy

## Development

### Prerequisites

- Node.js 16+ and npm
- Docker and Docker Compose (for production build)

### Setup Development Environment

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Building for Production

```bash
# Build production assets
npm run build

# The build output will be in the 'build' directory
```

## Project Structure

```
/src
  /components       # Reusable UI components
  /pages            # Application pages
  /services         # API services
  /hooks            # Custom React hooks
  /context          # React context providers
  /utils            # Utility functions
  /assets           # Static assets (images, fonts, etc.)
  /styles           # Global styles and theme configuration
```

## API Integration

The UI integrates with the following APIs:

1. EVE-NG API - For managing virtual machines
2. FortiSwitch Simulator API - For simulated FortiSwitch devices
3. FortiAP Simulator API - For simulated FortiAP devices
4. Meraki Simulator API - For simulated Meraki switches
5. API Gateway - For unified access to all APIs

## Customization

The UI can be customized by:

1. Modifying the theme in `src/styles/theme.js`
2. Adding brand-specific components in `src/components/brands/`
3. Extending the API services in `src/services/`

## Docker Deployment

The UI is containerized using Docker for easy deployment. The Dockerfile in this directory creates a production-ready container with Nginx serving the built React application.
