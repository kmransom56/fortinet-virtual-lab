#!/bin/bash

# deploy-network-devices.sh - Deploy network device configurations to EVE-NG
# Usage: ./deploy-network-devices.sh [eve-ng-server] [username] [destination-path]

# Check for required arguments
if [ $# -lt 3 ]; then
    echo "Usage: $0 [eve-ng-server] [username] [destination-path]"
    echo "Example: $0 192.168.1.100 root /opt/unetlab/labs/Fortinet-Virtual-Lab/network-devices"
    exit 1
fi

EVE_SERVER=$1
EVE_USER=$2
DEST_PATH=$3
LOCAL_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../eve-ng-topology" && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Deploying Network Device Configurations to EVE-NG ===${NC}"

# Check if SSH is available
if ! command -v ssh &> /dev/null; then
    echo -e "${RED}Error: SSH client not found. Please install OpenSSH client.${NC}"
    exit 1
fi

# Create destination directories on EVE-NG server
echo -e "${GREEN}[+] Creating directories on EVE-NG server...${NC}"
ssh ${EVE_USER}@${EVE_SERVER} "mkdir -p ${DEST_PATH}/meraki/arbys"
ssh ${EVE_USER}@${EVE_SERVER} "mkdir -p ${DEST_PATH}/meraki/bww"
ssh ${EVE_USER}@${EVE_SERVER} "mkdir -p ${DEST_PATH}/fortiswitch/sonic"
ssh ${EVE_USER}@${EVE_SERVER} "mkdir -p ${DEST_PATH}/fortiap/arbys"
ssh ${EVE_USER}@${EVE_SERVER} "mkdir -p ${DEST_PATH}/fortiap/bww"
ssh ${EVE_USER}@${EVE_SERVER} "mkdir -p ${DEST_PATH}/fortiap/sonic"

# Copy Meraki configurations
echo -e "${GREEN}[+] Copying Meraki configurations...${NC}"
scp ${LOCAL_PATH}/meraki/arbys/* ${EVE_USER}@${EVE_SERVER}:${DEST_PATH}/meraki/arbys/
scp ${LOCAL_PATH}/meraki/bww/* ${EVE_USER}@${EVE_SERVER}:${DEST_PATH}/meraki/bww/

# Copy FortiSwitch configurations
echo -e "${GREEN}[+] Copying FortiSwitch configurations...${NC}"
scp ${LOCAL_PATH}/fortiswitch/sonic/* ${EVE_USER}@${EVE_SERVER}:${DEST_PATH}/fortiswitch/sonic/

# Copy FortiAP configurations
echo -e "${GREEN}[+] Copying FortiAP configurations...${NC}"
scp ${LOCAL_PATH}/fortiap/arbys/* ${EVE_USER}@${EVE_SERVER}:${DEST_PATH}/fortiap/arbys/
scp ${LOCAL_PATH}/fortiap/bww/* ${EVE_USER}@${EVE_SERVER}:${DEST_PATH}/fortiap/bww/
scp ${LOCAL_PATH}/fortiap/sonic/* ${EVE_USER}@${EVE_SERVER}:${DEST_PATH}/fortiap/sonic/

# Set proper permissions on EVE-NG server
echo -e "${GREEN}[+] Setting permissions...${NC}"
ssh ${EVE_USER}@${EVE_SERVER} "chown -R root:root ${DEST_PATH} && chmod -R 755 ${DEST_PATH}"

echo -e "\n${GREEN}=== Network Device Configurations Deployed Successfully ===${NC}"
echo -e "Configurations have been deployed to: ${YELLOW}${DEST_PATH}${NC}"
echo -e "\nNext steps:"
echo -e "1. Import these configurations into your EVE-NG lab"
echo -e "2. Ensure all device images are properly loaded in EVE-NG"
echo -e "3. Start the lab and verify connectivity"

echo -e "${GREEN}Deployment completed!${NC}"
