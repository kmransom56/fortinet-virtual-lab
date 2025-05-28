#!/bin/bash

# Fortinet Virtual Lab Shutdown Script
# This script stops the entire lab environment including EVE-NG VMs and Docker containers

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
echo "             Virtual Lab Environment Shutdown               "
echo "==============================================================="

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
    echo "Only Docker components will be stopped."
    return 1
  fi
}

# Function to stop EVE-NG lab for a specific brand
stop_eve_ng_lab() {
  local brand=$1
  local lab_path=$2
  
  echo "Stopping ${brand} EVE-NG environment..."
  
  # Use curl to stop the lab through EVE-NG API
  response=$(curl -s -k -X PUT \
    -u "${EVE_NG_USERNAME}:${EVE_NG_PASSWORD}" \
    "${EVE_NG_URL}/api/labs/${lab_path}/stop" \
    -H "Content-Type: application/json")
  
  if [[ $response == *""success"":true* ]]; then
    echo "${brand} EVE-NG lab stopped successfully."
  else
    echo "Warning: Could not stop ${brand} EVE-NG lab. Response: ${response}"
  fi
}

# Stop Docker containers
stop_docker_services() {
  echo "Stopping Docker services..."
  docker-compose down
  
  if [ $? -eq 0 ]; then
    echo "Docker services stopped successfully."
  else
    echo "Error: Failed to stop Docker services."
    exit 1
  fi
}

# Main execution
echo "Stopping Fortinet Virtual Lab environment..."

# Check if EVE-NG is reachable and stop labs if it is
if check_eve_ng; then
  # Parse the lab paths (need to remove escape characters for API call)
  arbys_path=$(echo $ARBYS_LAB_PATH | sed 's/\\ / /g')
  bww_path=$(echo $BWW_LAB_PATH | sed 's/\\ / /g')
  sonic_path=$(echo $SONIC_LAB_PATH | sed 's/\\ / /g')
  
  # Prompt user for which brand to stop
  echo "\nWhich brand environment would you like to stop?"
  echo "1. Arby's"
  echo "2. Buffalo Wild Wings"
  echo "3. Sonic"
  echo "4. All brands"
  echo "5. Skip EVE-NG (Docker services only)"
  read -p "Enter choice [1-5]: " brand_choice
  
  case $brand_choice in
    1)
      stop_eve_ng_lab "Arby's" "$arbys_path"
      ;;
    2)
      stop_eve_ng_lab "Buffalo Wild Wings" "$bww_path"
      ;;
    3)
      stop_eve_ng_lab "Sonic" "$sonic_path"
      ;;
    4)
      stop_eve_ng_lab "Arby's" "$arbys_path"
      stop_eve_ng_lab "Buffalo Wild Wings" "$bww_path"
      stop_eve_ng_lab "Sonic" "$sonic_path"
      ;;
    5)
      echo "Skipping EVE-NG lab shutdown."
      ;;
    *)
      echo "Invalid choice. Skipping EVE-NG lab shutdown."
      ;;
  esac
fi

# Stop Docker services
stop_docker_services

# Print completion message
echo "\n==============================================================="
echo "Fortinet Virtual Lab stopped successfully!"
echo "\nTo start the environment again, run: ./scripts/start-lab.sh"
echo "==============================================================="