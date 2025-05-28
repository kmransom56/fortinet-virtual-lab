#!/bin/bash

# Fortinet Virtual Lab Startup Script
# This script starts the entire lab environment including EVE-NG VMs and Docker containers

set -e

# Load environment variables
if [ -f ".env" ]; then
  echo "Loading environment variables..."
  export $(grep -v '^#' .env | xargs)
else
  echo "Error: .env file not found."
  echo "Please copy .env.example to .env and configure your settings."
  exit 1
fi

# ASCII Art Banner
echo "==============================================================="
echo "   _____           _   _            _     _          _     "
echo "  |  ___|__  _ __| |_(_)_ __   ___| |_  | |    __ _| |__  "
echo "  | |_ / _ \| '__| __| | '_ \ / _ \ __| | |   / _\` | '_ \ "
echo "  |  _| (_) | |  | |_| | | | |  __/ |_  | |__| (_| | |_) |"
echo "  |_|  \___/|_|   \__|_|_| |_|\___|\__| |_____\__,_|_.__/ "
echo "                                                           "
echo "==============================================================="
echo "                 Virtual Lab Environment                     "
echo "==============================================================="

# Check for Docker
if ! command -v docker &> /dev/null; then
  echo "Error: Docker is not installed or not in PATH."
  exit 1
fi

# Check for Docker Compose
if ! command -v docker-compose &> /dev/null; then
  echo "Error: Docker Compose is not installed or not in PATH."
  exit 1
fi

# Function to check if EVE-NG is reachable
check_eve_ng() {
  echo "Checking EVE-NG connectivity..."
  if curl -s -k -m 5 "${EVE_NG_URL}" > /dev/null; then
    echo "EVE-NG is reachable."
    return 0
  else
    echo "Warning: EVE-NG server at ${EVE_NG_URL} is not reachable."
    echo "Only Docker components will be started."
    return 1
  fi
}

# Function to start EVE-NG lab for a specific brand
start_eve_ng_lab() {
  local brand=$1
  local lab_path=$2
  
  echo "Starting ${brand} EVE-NG environment..."
  
  # Use curl to start the lab through EVE-NG API
  response=$(curl -s -k -X PUT \
    -u "${EVE_NG_USERNAME}:${EVE_NG_PASSWORD}" \
    "${EVE_NG_URL}/api/labs/${lab_path}/start" \
    -H "Content-Type: application/json")
  
  if [[ $response == *""success"":true* ]]; then
    echo "${brand} EVE-NG lab started successfully."
  else
    echo "Warning: Could not start ${brand} EVE-NG lab. Response: ${response}"
  fi
}

# Start Docker containers
start_docker_services() {
  echo "Starting Docker services..."
  docker-compose up -d
  
  if [ $? -eq 0 ]; then
    echo "Docker services started successfully."
  else
    echo "Error: Failed to start Docker services."
    exit 1
  fi
}

# Main execution
echo "Starting Fortinet Virtual Lab environment..."

# Start Docker containers first
start_docker_services

# Check if EVE-NG is reachable and start labs if it is
if check_eve_ng; then
  # Parse the lab paths (need to remove escape characters for API call)
  arbys_path=$(echo $ARBYS_LAB_PATH | sed 's/\\ / /g')
  bww_path=$(echo $BWW_LAB_PATH | sed 's/\\ / /g')
  sonic_path=$(echo $SONIC_LAB_PATH | sed 's/\\ / /g')
  
  # Prompt user for which brand to start
  echo "\nWhich brand environment would you like to start?"
  echo "1. Arby's"
  echo "2. Buffalo Wild Wings"
  echo "3. Sonic"
  echo "4. All brands"
  echo "5. Skip EVE-NG (Docker services only)"
  read -p "Enter choice [1-5]: " brand_choice
  
  case $brand_choice in
    1)
      start_eve_ng_lab "Arby's" "$arbys_path"
      ;;
    2)
      start_eve_ng_lab "Buffalo Wild Wings" "$bww_path"
      ;;
    3)
      start_eve_ng_lab "Sonic" "$sonic_path"
      ;;
    4)
      start_eve_ng_lab "Arby's" "$arbys_path"
      start_eve_ng_lab "Buffalo Wild Wings" "$bww_path"
      start_eve_ng_lab "Sonic" "$sonic_path"
      ;;
    5)
      echo "Skipping EVE-NG lab startup."
      ;;
    *)
      echo "Invalid choice. Skipping EVE-NG lab startup."
      ;;
  esac
fi

# Print access information
echo "\n==============================================================="
echo "Fortinet Virtual Lab started successfully!"
echo "==============================================================="
echo "Management interface: http://localhost:8080"
echo "API Gateway: http://localhost:3000"
echo "FortiSwitch Simulator: http://localhost:3001"
echo "FortiAP Simulator: http://localhost:3002"
echo "Meraki Simulator: http://localhost:3003"
echo "EVE-NG Connector: http://localhost:3004"

if [[ $brand_choice -eq 1 || $brand_choice -eq 4 ]]; then
  echo "\nArby's environment is starting. Devices may take a few minutes to boot."
fi

if [[ $brand_choice -eq 2 || $brand_choice -eq 4 ]]; then
  echo "\nBuffalo Wild Wings environment is starting. Devices may take a few minutes to boot."
fi

if [[ $brand_choice -eq 3 || $brand_choice -eq 4 ]]; then
  echo "\nSonic environment is starting. Devices may take a few minutes to boot."
fi

echo "\nTo stop the environment, run: ./scripts/stop-lab.sh"
echo "==============================================================="