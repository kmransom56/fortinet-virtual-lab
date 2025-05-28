#!/bin/bash

# Stop-lab.sh - Script to stop the Fortinet Virtual Lab environment
# This script gracefully shuts down all components of the virtual lab

# Define text styling
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Display banner
echo -e "${BOLD}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║             FORTINET VIRTUAL LAB STOPPER           ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required dependencies
if ! command_exists docker || ! command_exists docker-compose; then
    echo -e "${RED}✘ Docker or Docker Compose is not installed.${NC}"
    exit 1
fi

# Move to the project root directory (assuming script is in scripts/)
cd "$(dirname "$0")/.." || exit 1

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}✘ docker-compose.yml not found in the project root directory.${NC}"
    exit 1
fi

echo -e "${BOLD}Stopping Fortinet Virtual Lab environment...${NC}"

# Check for running containers
RUNNING_CONTAINERS=$(docker-compose ps -q | wc -l)

if [ "$RUNNING_CONTAINERS" -eq "0" ]; then
    echo -e "${YELLOW}⚠ No running containers found. The lab environment may already be stopped.${NC}"
    
    # Ask if the user wants to force cleanup
    read -p "Would you like to force cleanup of any stopped containers? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠ Forcing cleanup of stopped containers...${NC}"
        docker-compose down -v
        echo -e "${GREEN}✓ Cleanup completed.${NC}"
    else
        echo -e "${YELLOW}⚠ No action taken.${NC}"
    fi
    
    exit 0
fi

# Stop the containers
echo -e "${YELLOW}⚠ Stopping running containers...${NC}"
docker-compose down

# Check if containers stopped successfully
if [ $? -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ Fortinet Virtual Lab environment stopped successfully!${NC}"
    
    # Ask if the user wants to remove volumes as well
    echo -e "${YELLOW}⚠ Do you want to remove all data volumes as well?${NC}"
    echo -e "${YELLOW}  (This will delete all saved data in the lab environment)${NC}"
    read -p "Remove volumes? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠ Removing data volumes...${NC}"
        docker-compose down -v
        echo -e "${GREEN}✓ Data volumes removed successfully.${NC}"
    else
        echo -e "${GREEN}✓ Data volumes preserved.${NC}"
    fi
    
    echo -e "\n${BOLD}Lab environment status:${NC}"
    echo -e "All services: ${GREEN}Stopped${NC}"
    echo -e "\n${BOLD}To restart the lab environment, use:${NC}"
    echo -e "${YELLOW}./scripts/start-lab.sh${NC}"
else
    echo -e "${RED}${BOLD}✘ Failed to stop Fortinet Virtual Lab environment.${NC}"
    echo -e "${YELLOW}Please check the Docker logs for more information:${NC}"
    echo -e "${YELLOW}docker-compose logs${NC}"
    exit 1
fi

echo -e "\n${BOLD}Thank you for using Fortinet Virtual Lab!${NC}"
