#!/bin/bash

# download-images.sh - Script to download virtual machine images from Fortinet Development Network and Cisco DevNet
# This script automates the process of acquiring the necessary VM images for the lab environment

# Define text styling
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Display banner
echo -e "${BOLD}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║           FORTINET VIRTUAL LAB IMAGE DOWNLOADER    ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required dependencies
echo -e "${BOLD}Checking dependencies...${NC}"

MISSING_DEPS=0

if ! command_exists curl; then
    echo -e "${RED}✘ curl is not installed. Please install curl first.${NC}"
    MISSING_DEPS=1
else
    echo -e "${GREEN}✓ curl is installed${NC}"
fi

if ! command_exists jq; then
    echo -e "${RED}✘ jq is not installed. Please install jq first.${NC}"
    MISSING_DEPS=1
else
    echo -e "${GREEN}✓ jq is installed${NC}"
fi

if [ $MISSING_DEPS -eq 1 ]; then
    echo -e "${RED}${BOLD}Missing required dependencies. Please install them and try again.${NC}"
    exit 1
fi

# Move to the project root directory (assuming script is in scripts/)
cd "$(dirname "$0")/.." || exit 1

# Create directory for VM images if it doesn't exist
VMIMAGE_DIR="./vm-images"
mkdir -p "$VMIMAGE_DIR"

# Function to authenticate with Fortinet Developer Network
auth_fortinet() {
    echo -e "${YELLOW}⚠ Authenticating with Fortinet Developer Network...${NC}"
    
    # Check if credentials file exists
    CREDS_FILE="./.fortinet-creds"
    if [ -f "$CREDS_FILE" ]; then
        source "$CREDS_FILE"
    else
        echo -e "${YELLOW}Fortinet Developer Network credentials required.${NC}"
        read -p "Username: " FORTINET_USERNAME
        read -s -p "Password: " FORTINET_PASSWORD
        echo
        
        # Save credentials for future use (optional)
        read -p "Save credentials for future use? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "FORTINET_USERNAME=\"$FORTINET_USERNAME\"" > "$CREDS_FILE"
            echo "FORTINET_PASSWORD=\"$FORTINET_PASSWORD\"" >> "$CREDS_FILE"
            chmod 600 "$CREDS_FILE"
            echo -e "${GREEN}✓ Credentials saved.${NC}"
        fi
    fi
    
    # Generate authentication token
    FORTINET_TOKEN=$(curl -s -X POST "https://customerapiauth.fortinet.com/api/v1/oauth/token/" \
        -H "Content-Type: application/json" \
        -d "{\
            \"username\": \"$FORTINET_USERNAME\",\
            \"password\": \"$FORTINET_PASSWORD\",\
            \"client_id\": \"fortinet-lab\",\
            \"grant_type\": \"password\"\
        }" | jq -r '.access_token')
    
    if [ -z "$FORTINET_TOKEN" ] || [ "$FORTINET_TOKEN" == "null" ]; then
        echo -e "${RED}✘ Authentication failed. Please check your credentials and try again.${NC}"
        exit 1
    else
        echo -e "${GREEN}✓ Successfully authenticated with Fortinet Developer Network.${NC}"
        return 0
    fi
}

# Function to authenticate with Cisco DevNet
auth_cisco() {
    echo -e "${YELLOW}⚠ Authenticating with Cisco DevNet...${NC}"
    
    # Check if credentials file exists
    CREDS_FILE="./.cisco-creds"
    if [ -f "$CREDS_FILE" ]; then
        source "$CREDS_FILE"
    else
        echo -e "${YELLOW}Cisco DevNet credentials required.${NC}"
        read -p "Username: " CISCO_USERNAME
        read -s -p "Password: " CISCO_PASSWORD
        echo
        
        # Save credentials for future use (optional)
        read -p "Save credentials for future use? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "CISCO_USERNAME=\"$CISCO_USERNAME\"" > "$CREDS_FILE"
            echo "CISCO_PASSWORD=\"$CISCO_PASSWORD\"" >> "$CREDS_FILE"
            chmod 600 "$CREDS_FILE"
            echo -e "${GREEN}✓ Credentials saved.${NC}"
        fi
    fi
    
    # Generate authentication token
    CISCO_TOKEN=$(curl -s -X POST "https://cloudsso.cisco.com/as/token.oauth2" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=password&client_id=fortinet-lab&username=$CISCO_USERNAME&password=$CISCO_PASSWORD" | jq -r '.access_token')
    
    if [ -z "$CISCO_TOKEN" ] || [ "$CISCO_TOKEN" == "null" ]; then
        echo -e "${RED}✘ Authentication failed. Please check your credentials and try again.${NC}"
        exit 1
    else
        echo -e "${GREEN}✓ Successfully authenticated with Cisco DevNet.${NC}"
        return 0
    fi
}

# Function to download FortiGate VM image
download_fortigate() {
    echo -e "${YELLOW}⚠ Downloading FortiGate VM image...${NC}"
    
    # Get latest available version
    LATEST_VERSION=$(curl -s -H "Authorization: Bearer $FORTINET_TOKEN" \
        "https://support.fortinet.com/api/v1/products/fortigate-vm/versions" \
        | jq -r '.versions[0]')
    
    echo -e "${GREEN}Latest FortiGate version: $LATEST_VERSION${NC}"
    
    # Get download URL for EVE-NG compatible image
    DOWNLOAD_URL=$(curl -s -H "Authorization: Bearer $FORTINET_TOKEN" \
        "https://support.fortinet.com/api/v1/products/fortigate-vm/$LATEST_VERSION/downloads?platform=kvm" \
        | jq -r '.downloads[] | select(.file_name | contains("eve-ng")) | .download_url')
    
    if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" == "null" ]; then
        echo -e "${RED}✘ Could not find EVE-NG compatible FortiGate image. Trying standard KVM image...${NC}"
        
        DOWNLOAD_URL=$(curl -s -H "Authorization: Bearer $FORTINET_TOKEN" \
            "https://support.fortinet.com/api/v1/products/fortigate-vm/$LATEST_VERSION/downloads?platform=kvm" \
            | jq -r '.downloads[0].download_url')
        
        if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" == "null" ]; then
            echo -e "${RED}✘ Could not find any FortiGate VM image to download.${NC}"
            return 1
        fi
    fi
    
    # Extract filename from URL
    FILENAME=$(basename "$DOWNLOAD_URL")
    
    # Download the file
    echo -e "${YELLOW}⚠ Downloading $FILENAME...${NC}"
    curl -# -H "Authorization: Bearer $FORTINET_TOKEN" \
        -o "$VMIMAGE_DIR/$FILENAME" \
        "$DOWNLOAD_URL"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Successfully downloaded FortiGate VM image to $VMIMAGE_DIR/$FILENAME${NC}"
        return 0
    else
        echo -e "${RED}✘ Failed to download FortiGate VM image.${NC}"
        return 1
    fi
}

# Function to download FortiManager VM image
download_fortimanager() {
    echo -e "${YELLOW}⚠ Downloading FortiManager VM image...${NC}"
    
    # Get latest available version
    LATEST_VERSION=$(curl -s -H "Authorization: Bearer $FORTINET_TOKEN" \
        "https://support.fortinet.com/api/v1/products/fortimanager-vm/versions" \
        | jq -r '.versions[0]')
    
    echo -e "${GREEN}Latest FortiManager version: $LATEST_VERSION${NC}"
    
    # Get download URL for EVE-NG compatible image
    DOWNLOAD_URL=$(curl -s -H "Authorization: Bearer $FORTINET_TOKEN" \
        "https://support.fortinet.com/api/v1/products/fortimanager-vm/$LATEST_VERSION/downloads?platform=kvm" \
        | jq -r '.downloads[] | select(.file_name | contains("eve-ng")) | .download_url')
    
    if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" == "null" ]; then
        echo -e "${RED}✘ Could not find EVE-NG compatible FortiManager image. Trying standard KVM image...${NC}"
        
        DOWNLOAD_URL=$(curl -s -H "Authorization: Bearer $FORTINET_TOKEN" \
            "https://support.fortinet.com/api/v1/products/fortimanager-vm/$LATEST_VERSION/downloads?platform=kvm" \
            | jq -r '.downloads[0].download_url')
        
        if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" == "null" ]; then
            echo -e "${RED}✘ Could not find any FortiManager VM image to download.${NC}"
            return 1
        fi
    fi
    
    # Extract filename from URL
    FILENAME=$(basename "$DOWNLOAD_URL")
    
    # Download the file
    echo -e "${YELLOW}⚠ Downloading $FILENAME...${NC}"
    curl -# -H "Authorization: Bearer $FORTINET_TOKEN" \
        -o "$VMIMAGE_DIR/$FILENAME" \
        "$DOWNLOAD_URL"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Successfully downloaded FortiManager VM image to $VMIMAGE_DIR/$FILENAME${NC}"
        return 0
    else
        echo -e "${RED}✘ Failed to download FortiManager VM image.${NC}"
        return 1
    fi
}

# Function to download FortiAnalyzer VM image
download_fortianalyzer() {
    echo -e "${YELLOW}⚠ Downloading FortiAnalyzer VM image...${NC}"
    
    # Get latest available version
    LATEST_VERSION=$(curl -s -H "Authorization: Bearer $FORTINET_TOKEN" \
        "https://support.fortinet.com/api/v1/products/fortianalyzer-vm/versions" \
        | jq -r '.versions[0]')
    
    echo -e "${GREEN}Latest FortiAnalyzer version: $LATEST_VERSION${NC}"
    
    # Get download URL for EVE-NG compatible image
    DOWNLOAD_URL=$(curl -s -H "Authorization: Bearer $FORTINET_TOKEN" \
        "https://support.fortinet.com/api/v1/products/fortianalyzer-vm/$LATEST_VERSION/downloads?platform=kvm" \
        | jq -r '.downloads[] | select(.file_name | contains("eve-ng")) | .download_url')
    
    if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" == "null" ]; then
        echo -e "${RED}✘ Could not find EVE-NG compatible FortiAnalyzer image. Trying standard KVM image...${NC}"
        
        DOWNLOAD_URL=$(curl -s -H "Authorization: Bearer $FORTINET_TOKEN" \
            "https://support.fortinet.com/api/v1/products/fortianalyzer-vm/$LATEST_VERSION/downloads?platform=kvm" \
            | jq -r '.downloads[0].download_url')
        
        if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" == "null" ]; then
            echo -e "${RED}✘ Could not find any FortiAnalyzer VM image to download.${NC}"
            return 1
        fi
    fi
    
    # Extract filename from URL
    FILENAME=$(basename "$DOWNLOAD_URL")
    
    # Download the file
    echo -e "${YELLOW}⚠ Downloading $FILENAME...${NC}"
    curl -# -H "Authorization: Bearer $FORTINET_TOKEN" \
        -o "$VMIMAGE_DIR/$FILENAME" \
        "$DOWNLOAD_URL"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Successfully downloaded FortiAnalyzer VM image to $VMIMAGE_DIR/$FILENAME${NC}"
        return 0
    else
        echo -e "${RED}✘ Failed to download FortiAnalyzer VM image.${NC}"
        return 1
    fi
}

# Function to download Cisco Meraki VM image
download_meraki() {
    echo -e "${YELLOW}⚠ Downloading Cisco Meraki virtual switch image...${NC}"
    
    # Get download URL for Meraki vMX image
    DOWNLOAD_URL=$(curl -s -H "Authorization: Bearer $CISCO_TOKEN" \
        "https://devnetapi.cisco.com/sandbox/meraki/api/v1/images/vmx" \
        | jq -r '.url')
    
    if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" == "null" ]; then
        echo -e "${RED}✘ Could not find Meraki virtual switch image to download.${NC}"
        return 1
    fi
    
    # Extract filename from URL or use default
    FILENAME="meraki-vmx.ova"
    
    # Download the file
    echo -e "${YELLOW}⚠ Downloading $FILENAME...${NC}"
    curl -# -H "Authorization: Bearer $CISCO_TOKEN" \
        -o "$VMIMAGE_DIR/$FILENAME" \
        "$DOWNLOAD_URL"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Successfully downloaded Meraki virtual switch image to $VMIMAGE_DIR/$FILENAME${NC}"
        return 0
    else
        echo -e "${RED}✘ Failed to download Meraki virtual switch image.${NC}"
        return 1
    fi
}

# Main script execution
echo -e "${BOLD}Starting download of virtual machine images for Fortinet Virtual Lab...${NC}"

# Authenticate with Fortinet Developer Network
auth_fortinet

# Authenticate with Cisco DevNet
auth_cisco

# Download FortiGate VM images (one per brand)
echo -e "\n${BOLD}Downloading FortiGate VM images:${NC}"
for BRAND in "arbys" "bww" "sonic"; do
    download_fortigate
    if [ $? -ne 0 ]; then
        echo -e "${RED}✘ Failed to download FortiGate VM image for $BRAND. Exiting.${NC}"
        exit 1
    fi
done

# Download FortiManager VM images (one per brand)
echo -e "\n${BOLD}Downloading FortiManager VM images:${NC}"
for BRAND in "arbys" "bww" "sonic"; do
    download_fortimanager
    if [ $? -ne 0 ]; then
        echo -e "${RED}✘ Failed to download FortiManager VM image for $BRAND. Exiting.${NC}"
        exit 1
    fi
done

# Download FortiAnalyzer VM image (shared)
echo -e "\n${BOLD}Downloading FortiAnalyzer VM image:${NC}"
download_fortianalyzer
if [ $? -ne 0 ]; then
    echo -e "${RED}✘ Failed to download FortiAnalyzer VM image. Exiting.${NC}"
    exit 1
fi

# Download Meraki virtual switch image
echo -e "\n${BOLD}Downloading Meraki virtual switch image:${NC}"
download_meraki
if [ $? -ne 0 ]; then
    echo -e "${RED}✘ Failed to download Meraki virtual switch image. Exiting.${NC}"
    exit 1
fi

# Make scripts executable
chmod +x "$VMIMAGE_DIR"/*.sh 2>/dev/null

echo -e "\n${GREEN}${BOLD}✓ All virtual machine images downloaded successfully!${NC}"
echo -e "${BOLD}VM images are located in: $VMIMAGE_DIR${NC}"
echo -e "${YELLOW}Note: These images need to be imported into EVE-NG before use.${NC}"
echo -e "${YELLOW}See docs/eve-ng-import.md for instructions on importing images into EVE-NG.${NC}"

echo -e "\n${BOLD}Summary of downloaded images:${NC}"
ls -lh "$VMIMAGE_DIR"

echo -e "\n${BOLD}Thank you for using Fortinet Virtual Lab!${NC}"