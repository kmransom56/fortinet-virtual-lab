# Importing VM Images into EVE-NG

This guide provides step-by-step instructions for importing the downloaded Fortinet and Cisco virtual machine images into your EVE-NG environment.

## Prerequisites

- EVE-NG Professional installed and running
- SSH access to your EVE-NG server
- Virtual machine images downloaded using the `download-images.sh` script
- SCP (Secure Copy) or SFTP access to transfer files to the EVE-NG server

## Image Types and Locations

EVE-NG requires different VM image types to be placed in specific directories:

| Device Type | Image Format | EVE-NG Directory |
|-------------|--------------|------------------|
| FortiGate   | QCOW2        | `/opt/unetlab/addons/qemu/fortinet-FGT/` |
| FortiManager | QCOW2       | `/opt/unetlab/addons/qemu/fortinet-FMG/` |
| FortiAnalyzer | QCOW2      | `/opt/unetlab/addons/qemu/fortinet-FAZ/` |
| Cisco Meraki | OVA         | `/opt/unetlab/addons/qemu/meraki-vmx/` |

## Step 1: Transfer Images to EVE-NG Server

First, transfer the downloaded VM images to your EVE-NG server using SCP or another file transfer method.

```bash
# Example using SCP from your local machine
scp vm-images/* root@eve-ng-server-ip:/tmp/
```

## Step 2: Import FortiGate Images

SSH into your EVE-NG server and run the following commands to import the FortiGate VM images:

```bash
# Create the directory if it doesn't exist
sudo mkdir -p /opt/unetlab/addons/qemu/fortinet-FGT
cd /opt/unetlab/addons/qemu/fortinet-FGT

# Copy and extract the image (if compressed)
sudo cp /tmp/FGT_VM64_KVM-*.qcow2 .

# If you have multiple FortiGate images for different brands
sudo mv FGT_VM64_KVM-*-arbys.qcow2 virtioa.qcow2
sudo mv FGT_VM64_KVM-*-bww.qcow2 virtiob.qcow2
sudo mv FGT_VM64_KVM-*-sonic.qcow2 virtioc.qcow2

# Set proper permissions
sudo chmod 644 *.qcow2
```

## Step 3: Import FortiManager Images

```bash
# Create the directory if it doesn't exist
sudo mkdir -p /opt/unetlab/addons/qemu/fortinet-FMG
cd /opt/unetlab/addons/qemu/fortinet-FMG

# Copy and extract the image (if compressed)
sudo cp /tmp/FMG_VM64_KVM-*.qcow2 .

# If you have multiple FortiManager images for different brands
sudo mv FMG_VM64_KVM-*-arbys.qcow2 virtioa.qcow2
sudo mv FMG_VM64_KVM-*-bww.qcow2 virtiob.qcow2
sudo mv FMG_VM64_KVM-*-sonic.qcow2 virtioc.qcow2

# Set proper permissions
sudo chmod 644 *.qcow2
```

## Step 4: Import FortiAnalyzer Image

```bash
# Create the directory if it doesn't exist
sudo mkdir -p /opt/unetlab/addons/qemu/fortinet-FAZ
cd /opt/unetlab/addons/qemu/fortinet-FAZ

# Copy and extract the image (if compressed)
sudo cp /tmp/FAZ_VM64_KVM-*.qcow2 .
sudo mv FAZ_VM64_KVM-*.qcow2 virtioa.qcow2

# Set proper permissions
sudo chmod 644 *.qcow2
```

## Step 5: Import Cisco Meraki Virtual Switch Image

```bash
# Create the directory if it doesn't exist
sudo mkdir -p /opt/unetlab/addons/qemu/meraki-vmx
cd /opt/unetlab/addons/qemu/meraki-vmx

# Copy the OVA file
sudo cp /tmp/meraki-vmx.ova .

# Extract the VMDK from the OVA and convert to QCOW2
sudo tar -xf meraki-vmx.ova
sudo qemu-img convert -f vmdk -O qcow2 *.vmdk virtioa.qcow2

# Clean up temporary files
sudo rm -f *.ova *.vmdk *.ovf

# Set proper permissions
sudo chmod 644 *.qcow2
```

## Step 6: Fix Permissions and Update EVE-NG

After importing all images, fix permissions and update the EVE-NG database:

```bash
# Fix permissions for all imported images
sudo /opt/unetlab/wrappers/unl_wrapper -a fixpermissions

# Restart EVE-NG services
sudo systemctl restart pnetlab
```

## Step 7: Verify Image Import

Log in to the EVE-NG web interface and verify that the new device templates are available:

1. Create a new lab or edit an existing one
2. Click "Add Node"
3. In the node selection dialog, you should see:
   - FortiGate (under Fortinet category)
   - FortiManager (under Fortinet category)
   - FortiAnalyzer (under Fortinet category)
   - Meraki vMX (under Cisco category)

## Troubleshooting

### Images Not Appearing in EVE-NG

If your images don't appear in the EVE-NG web interface:

1. Verify permissions: All files should be owned by `root:root` with permissions `644`
2. Check file naming: The main disk image must be named `virtioa.qcow2`
3. Restart EVE-NG: `sudo systemctl restart pnetlab`
4. Check EVE-NG logs: `sudo tail -f /opt/unetlab/data/Logs/pnetlab.log`

### Converting OVA/VMDK to QCOW2

If you have issues converting Meraki VMDK files to QCOW2:

```bash
# Install qemu-utils if not already installed
sudo apt-get update
sudo apt-get install -y qemu-utils

# Then try the conversion again
sudo qemu-img convert -f vmdk -O qcow2 source.vmdk virtioa.qcow2
```

## Next Steps

After successfully importing all VM images into EVE-NG, you can:

1. Create network topologies for Arby's, BWW, and Sonic environments
2. Import configuration files for each device
3. Connect EVE-NG to your Docker containers using the EVE-NG API connector

For detailed information on network topologies, refer to the [architecture.md](architecture.md) document.