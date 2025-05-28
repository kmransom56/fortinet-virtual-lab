#!/bin/bash

# deploy-to-eve-ng.sh - Deploy Fortinet Virtual Lab to EVE-NG server
# Usage: ./deploy-to-eve-ng.sh [eve-ng-server] [username] [destination-path]

# Check for required arguments
if [ $# -lt 3 ]; then
    echo "Usage: $0 [eve-ng-server] [username] [destination-path]"
    echo "Example: $0 192.168.1.100 root /opt/unetlab/labs/Fortinet-Virtual-Lab"
    exit 1
fi

EVE_SERVER=$1
EVE_USER=$2
DEST_PATH=$3
LOCAL_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../eve-ng-topology" && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Deploying Fortinet Virtual Lab to EVE-NG ===${NC}"

# Check if SSH is available
if ! command -v ssh &> /dev/null; then
    echo -e "${RED}Error: SSH client not found. Please install OpenSSH client.${NC}"
    exit 1
fi

# Create destination directory on EVE-NG server
echo -e "${GREEN}[+] Creating directory on EVE-NG server...${NC}"
ssh ${EVE_USER}@${EVE_SERVER} "mkdir -p ${DEST_PATH}/configs"

# Copy configuration files
echo -e "${GREEN}[+] Copying configuration files...${NC}"
scp -r ${LOCAL_PATH}/* ${EVE_USER}@${EVE_SERVER}:${DEST_PATH}/

# Set proper permissions on EVE-NG server
echo -e "${GREEN}[+] Setting permissions...${NC}"
ssh ${EVE_USER}@${EVE_SERVER} "chown -R root:root ${DEST_PATH} && chmod -R 755 ${DEST_PATH}"

# Fix EVE-NG lab permissions
echo -e "${GREEN}[+] Fixing EVE-NG lab permissions...${NC}"
ssh ${EVE_USER}@${EVE_SERVER} "cd /opt/unetlab/ && \
    /opt/unetlab/wrappers/unl_wrapper -a fixpermissions"

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
echo -e "Lab has been deployed to: ${YELLOW}${DEST_PATH}${NC}"
echo -e "You can now access the lab through the EVE-NG web interface."
echo -e "\n${YELLOW}Note:${NC} Make sure you have the required VM images uploaded to EVE-NG:"
echo -e "- vFortiManager-7.2.3"
echo -e "- vFortiAnalyzer-7.2.3"
echo -e "- vFortiGate-7.2.3"

echo -e "${GREEN}Lab deployment completed successfully!${NC}"
