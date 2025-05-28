#!/bin/bash

# Start-lab.sh - Script to start the Fortinet Virtual Lab environment
# This script initializes and starts all components of the virtual lab

# Define text styling
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Display banner
echo -e "${BOLD}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║             FORTINET VIRTUAL LAB STARTER           ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required dependencies
echo -e "${BOLD}Checking dependencies...${NC}"

MISSING_DEPS=0

if ! command_exists docker; then
    echo -e "${RED}✘ Docker is not installed. Please install Docker first.${NC}"
    MISSING_DEPS=1
else
    echo -e "${GREEN}✓ Docker is installed${NC}"
fi

if ! command_exists docker-compose; then
    echo -e "${RED}✘ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    MISSING_DEPS=1
else
    echo -e "${GREEN}✓ Docker Compose is installed${NC}"
fi

if [ $MISSING_DEPS -eq 1 ]; then
    echo -e "${RED}${BOLD}Missing required dependencies. Please install them and try again.${NC}"
    exit 1
fi

# Load environment variables if .env exists
ENV_FILE="../.env"
if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}✓ Loading configuration from .env file${NC}"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo -e "${YELLOW}⚠ No .env file found, using default values${NC}"
    # Create .env file from example if it exists
    if [ -f "../.env.example" ]; then
        echo -e "${YELLOW}⚠ Creating .env file from .env.example${NC}"
        cp "../.env.example" "$ENV_FILE"
    fi
fi

# Move to the project root directory (assuming script is in scripts/)
cd "$(dirname "$0")/.." || exit 1

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}✘ docker-compose.yml not found in the project root directory.${NC}"
    exit 1
fi

echo -e "${BOLD}Starting Fortinet Virtual Lab environment...${NC}"

# Pull the latest images
echo -e "${YELLOW}⚠ Pulling latest Docker images. This might take a while...${NC}"
docker-compose pull

# Start the containers
echo -e "${YELLOW}⚠ Starting containers...${NC}"
docker-compose up -d

# Check if containers started successfully
if [ $? -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ Fortinet Virtual Lab environment started successfully!${NC}"
    
    # Get the UI URL
    UI_PORT=${UI_PORT:-8080}
    echo -e "${BOLD}Web Interface: ${GREEN}http://localhost:$UI_PORT${NC}"
    
    # Show health check information
    echo -e "\n${BOLD}Service Health Check:${NC}"
    sleep 5 # Give some time for services to initialize
    
    UI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$UI_PORT || echo "Failed")
    FORTISWITCH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/api/health || echo "Failed")
    FORTIAP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/api/health || echo "Failed")
    MERAKI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8083/api/health || echo "Failed")
    
    # Display status for each service
    if [ "$UI_STATUS" == "200" ]; then
        echo -e "Web UI: ${GREEN}Running${NC}"
    else
        echo -e "Web UI: ${YELLOW}Starting... (Status: $UI_STATUS)${NC}"
    fi
    
    if [ "$FORTISWITCH_STATUS" == "200" ]; then
        echo -e "FortiSwitch Simulator: ${GREEN}Running${NC}"
    else
        echo -e "FortiSwitch Simulator: ${YELLOW}Starting... (Status: $FORTISWITCH_STATUS)${NC}"
    fi
    
    if [ "$FORTIAP_STATUS" == "200" ]; then
        echo -e "FortiAP Simulator: ${GREEN}Running${NC}"
    else
        echo -e "FortiAP Simulator: ${YELLOW}Starting... (Status: $FORTIAP_STATUS)${NC}"
    fi
    
    if [ "$MERAKI_STATUS" == "200" ]; then
        echo -e "Meraki Simulator: ${GREEN}Running${NC}"
    else
        echo -e "Meraki Simulator: ${YELLOW}Starting... (Status: $MERAKI_STATUS)${NC}"
    fi
    
    echo -e "\n${BOLD}Note:${NC} Services may take a few moments to fully initialize."
    echo -e "${BOLD}Use '${YELLOW}./scripts/stop-lab.sh${NC}${BOLD}' to stop the environment.${NC}"
else
    echo -e "${RED}${BOLD}✘ Failed to start Fortinet Virtual Lab environment.${NC}"
    echo -e "${YELLOW}Please check the Docker logs for more information:${NC}"
    echo -e "${YELLOW}docker-compose logs${NC}"
    exit 1
fi

echo -e "\n${BOLD}Thank you for using Fortinet Virtual Lab!${NC}"
