import { writable } from 'svelte/store';

// Store to track network discovery status
export const discoveryStatusStore = writable<{
	scanning: boolean;
	error: string | null;
}>({
	scanning: false,
	error: null
});

// Store to track discovered device addresses
export const discoveredDevicesStore = writable<Map<string, DeviceInfo>>(new Map());

export interface DeviceInfo {
	id: string; // Unique identifier
	ipAddress: string; // IP address
	name?: string; // Device name if available
	type?: string; // Device type if identifiable
	manufacturerInfo?: string; // Manufacturer info if available
	mac?: string; // MAC address if available
}

export const NetworkDiscovery = {
	/**
	 * Start scanning for smart devices on the local network
	 */
	startDiscovery: async (): Promise<void> => {
		discoveryStatusStore.update((status) => ({ ...status, scanning: true, error: null }));

		try {
			// First clear previous results
			discoveredDevicesStore.set(new Map());

			// We'll use multiple discovery methods
			await Promise.all([
				discoverDevicesViaMdns(),
				discoverDevicesViaSsdp(),
				scanNetworkForDevices()
			]);
		} catch (error) {
			discoveryStatusStore.update((status) => ({
				...status,
				scanning: false,
				error: error instanceof Error ? error.message : String(error)
			}));
		} finally {
			discoveryStatusStore.update((status) => ({ ...status, scanning: false }));
		}
	},

	/**
	 * Test connection to a specific device
	 */
	testDeviceConnection: async (ipAddress: string): Promise<boolean> => {
		try {
			// Try to detect the device type based on open ports
			const deviceType = await detectDeviceType(ipAddress);

			if (deviceType) {
				// Use the appropriate endpoint based on device type
				let url;
				switch (deviceType) {
					case 'hama-bulb':
					case 'yeelight-bulb':
						url = `http://${ipAddress}/api/v1/status`;
						break;
					case 'google-cast':
					case 'google-nest':
						url = `http://${ipAddress}:8008/setup/eureka_info`;
						break;
					default:
						url = `http://${ipAddress}/api/status`;
				}

				const response = await fetch(url, {
					method: 'GET',
					headers: {
						Accept: 'application/json'
					},
					signal: AbortSignal.timeout(3000)
				});

				return response.ok;
			}

			// Fallback to basic connectivity test
			return await isIpReachable(ipAddress);
		} catch (error) {
			console.warn(`Failed to connect to device at ${ipAddress}:`, error);
			// Even if we fail to connect via HTTP, the device might be reachable
			// Try a basic connectivity check
			return await isIpReachable(ipAddress);
		}
	},

	/**
	 * Get all discovered devices
	 */
	getDiscoveredDevices: (): DeviceInfo[] => {
		let devices: DeviceInfo[] = [];
		discoveredDevicesStore.subscribe((deviceMap) => {
			devices = Array.from(deviceMap.values());
		})();
		return devices;
	}
};

/**
 * Uses mDNS/Bonjour to discover devices that advertise services
 */
async function discoverDevicesViaMdns(): Promise<void> {
	console.log('Starting mDNS discovery...');

	// In a browser environment, we need to simulate this
	// In a real setup, we'd use a WebSocket connection to a backend service
	// that implements mDNS discovery

	try {
		// Simulate the process of finding devices
		// In production we'd connect to an actual mDNS service

		const foundDevices: DeviceInfo[] = [
			{
				id: generateId('google-nest'),
				ipAddress: '192.168.188.123',
				name: 'Google Nest Hub',
				type: 'google-nest',
				manufacturerInfo: 'Google LLC',
				mac: 'F4:F5:D8:' + generateRandomMacSuffix()
			},
			{
				id: generateId('google-tv'),
				ipAddress: '192.168.188.124',
				name: 'Google TV',
				type: 'google-cast',
				manufacturerInfo: 'Google LLC',
				mac: 'A4:77:33:' + generateRandomMacSuffix()
			},
			{
				id: generateId('yeelight'),
				ipAddress: '192.168.188.185',
				name: 'Yeelight LED Bulb',
				type: 'yeelight-bulb',
				manufacturerInfo: 'Yeelight',
				mac: '54:48:E6:66:11:41'
			}
		];

		await addDevicesToStore(foundDevices);
	} catch (error) {
		console.error('Error in mDNS discovery:', error);
	}
}

/**
 * Uses SSDP to discover devices
 */
async function discoverDevicesViaSsdp(): Promise<void> {
	console.log('Starting SSDP discovery...');

	try {
		// This would be real SSDP discovery in production
		const foundDevices: DeviceInfo[] = [
			{
				id: generateId('hama-1'),
				ipAddress: '192.168.188.130',
				name: 'Hama Smart Bulb Living Room',
				type: 'hama-bulb',
				manufacturerInfo: 'Hama GmbH & Co KG',
				mac: '18:FE:34:' + generateRandomMacSuffix()
			},
			{
				id: generateId('hama-2'),
				ipAddress: '192.168.188.131',
				name: 'Hama Smart Bulb Kitchen',
				type: 'hama-bulb',
				manufacturerInfo: 'Hama GmbH & Co KG',
				mac: '18:FE:34:' + generateRandomMacSuffix()
			},
			{
				id: generateId('hama-3'),
				ipAddress: '192.168.188.132',
				name: 'Hama Smart Bulb Bedroom',
				type: 'hama-bulb',
				manufacturerInfo: 'Hama GmbH & Co KG',
				mac: '18:FE:34:' + generateRandomMacSuffix()
			}
		];

		await addDevicesToStore(foundDevices);
	} catch (error) {
		console.error('Error in SSDP discovery:', error);
	}
}

/**
 * Direct network scan for IP addresses likely to be smart home devices
 */
async function scanNetworkForDevices(): Promise<void> {
	console.log('Starting network scan...');

	// Get the local IP address to determine the subnet
	const subnet = await detectLocalSubnet();
	if (!subnet) {
		console.warn('Could not determine local subnet, using common subnet patterns');
		// In a real implementation, we would scan common subnet patterns
	}

	try {
		// In a real implementation, we would actually scan the network
		// For now, we'll simulate finding devices on these subnets
		const foundDevices: DeviceInfo[] = [];

		// Add any devices that weren't found by other methods
		if (!deviceExistsInStore('192.168.188.130') && !deviceExistsInStore('192.168.188.131')) {
			foundDevices.push({
				id: generateId('unknown-1'),
				ipAddress: '192.168.188.150',
				name: 'Unknown Smart Device',
				type: 'unknown',
				mac: '00:1A:79:' + generateRandomMacSuffix()
			});
		}

		await addDevicesToStore(foundDevices);
	} catch (error) {
		console.error('Error in network scan:', error);
	}
}

/**
 * Detect what type of device is at an IP address
 */
async function detectDeviceType(ipAddress: string): Promise<string | null> {
	try {
		// In a real implementation, we would probe open ports and analyze responses
		// For now, simulate based on the IP
		const lastOctet = parseInt(ipAddress.split('.')[3]);

		if (lastOctet >= 123 && lastOctet <= 124) {
			return 'google-cast';
		} else if (lastOctet === 125) {
			return 'yeelight-bulb';
		} else if (lastOctet >= 130 && lastOctet <= 132) {
			return 'hama-bulb';
		}

		return null;
	} catch {
		// Ignore error
		return null;
	}
}

/**
 * Helper to check if an IP is reachable
 */
async function isIpReachable(ipAddress: string): Promise<boolean> {
	try {
		// In a browser, we can't ping directly
		// We'll simulate this check
		// In production, this would use a backend service to check connectivity

		// Simulate a quick connection check
		await new Promise((resolve) => setTimeout(resolve, 300));

		// For demonstration, make all IPs in our range "reachable"
		return ipAddress.startsWith('192.168.188.');
	} catch {
		return false;
	}
}

/**
 * Try to detect the local subnet
 */
async function detectLocalSubnet(): Promise<string | null> {
	try {
		// In a real implementation, we would get the local IP and determine subnet
		// For now, simulate this
		return '192.168.188';
	} catch {
		return null;
	}
}

/**
 * Check if a device with the given IP already exists in the store
 */
function deviceExistsInStore(ipAddress: string): boolean {
	let exists = false;
	discoveredDevicesStore.subscribe((deviceMap) => {
		exists = Array.from(deviceMap.values()).some((device) => device.ipAddress === ipAddress);
	})();
	return exists;
}

/**
 * Add devices to the store, avoiding duplicates
 */
async function addDevicesToStore(devices: DeviceInfo[]): Promise<void> {
	// Add a slight delay to simulate real discovery timing
	await new Promise((resolve) => setTimeout(resolve, 1000));

	discoveredDevicesStore.update((deviceMap) => {
		devices.forEach((device) => {
			// Use IP as the key to avoid adding the same device twice
			deviceMap.set(device.ipAddress, device);
		});
		return deviceMap;
	});
}

/**
 * Generate a random device ID with a prefix
 */
function generateId(prefix: string): string {
	return `${prefix}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Generate a random MAC address suffix (last 6 characters)
 */
function generateRandomMacSuffix(): string {
	const hexChars = '0123456789ABCDEF';
	let suffix = '';
	for (let i = 0; i < 6; i++) {
		suffix += hexChars[Math.floor(Math.random() * 16)];
		if (i % 2 === 1 && i < 5) suffix += ':';
	}
	return suffix;
}
