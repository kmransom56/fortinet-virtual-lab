#!/bin/bash

# Generate FortiGate configurations for BWW and Sonic
# Usage: ./generate-fortigate-configs.sh

# Function to replace placeholders in the template
replace_values() {
    local brand=$1
    local mgmt_ip=$2
    local internal_net=$3
    local internal_gw=$4
    local wan_net=$5
    
    # Convert brand to uppercase for hostname
    local brand_upper=$(echo $brand | tr '[:lower:]' '[:upper:]')
    
    # Create output directory if it doesn't exist
    mkdir -p "../eve-ng-topology/fortigates/${brand,,}"
    
    # Read the template and replace values
    sed -e "s/Arbys-FGT/${brand_upper}-FGT/g" \
        -e "s/10.0.0.12/${mgmt_ip}/g" \
        -e "s/192.168.10.0/${internal_net}/g" \
        -e "s/192.168.10.1/${internal_gw}/g" \
        -e "s/172.16.10.1/172.16.${brand_net}.1/g" \
        -e "s/172.16.10.0/172.16.${brand_net}.0/g" \
        "../eve-ng-topology/fortigates/arbys/arbys-fgt.conf" > "../eve-ng-topology/fortigates/${brand,,}/${brand}-fgt.conf"
    
    echo "Generated configuration for ${brand_upper} FortiGate at ../eve-ng-topology/fortigates/${brand,,}/${brand}-fgt.conf"
}

# Generate BWW configuration
replace_values "bww" "10.0.0.13" "192.168.20.0" "192.168.20.1" "172.16.20.1"

# Generate Sonic configuration
replace_values "sonic" "10.0.0.14" "192.168.30.0" "192.168.30.1" "172.16.30.1"

echo "FortiGate configurations generated successfully!"
