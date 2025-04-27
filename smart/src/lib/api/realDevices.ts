import { writable } from 'svelte/store';
import type { Device, SmartBulb, NestAudio } from './devices';
import type { DeviceInfo } from './networkDiscovery';

// Store for real device connections
export const connectedDevicesStore = writable<Map<string, RealDeviceConnection>>(new Map());

export interface RealDeviceConnection {
	deviceInfo: DeviceInfo;
	connectionStatus: 'connected' | 'disconnected' | 'error';
	lastCommunicated: Date;
	errorMessage?: string;
	capabilities: string[];
}

// Define parameter types for different commands
export interface GenericCommandParams {
	[key: string]: string | number | boolean;
}

export interface LightParams {
	brightness?: number;
	color?: string;
	power?: boolean;
	effect?: string;
	duration?: number;
	temperature?: number;
	name?: string;
	class?: string;
	[key: string]: string | number | boolean | undefined;
}

export interface AudioDeviceParams {
	volume?: number;
}

// Store for tracking open sockets to devices
const deviceSockets = new Map<string, WebSocket | null>();

// Device protocol handlers
export const DeviceProtocols = {
	// Hama smart bulb handler
	hama: {
		async connect(deviceInfo: DeviceInfo): Promise<RealDeviceConnection> {
			console.log(`Connecting to Hama smart bulb at ${deviceInfo.ipAddress}`);

			return {
				deviceInfo,
				connectionStatus: 'connected',
				lastCommunicated: new Date(),
				capabilities: ['toggle', 'brightness', 'color']
			};
		},

		async togglePower(connection: RealDeviceConnection): Promise<boolean> {
			// In a real implementation, this would send a command to the bulb
			console.log(`Toggling Hama bulb power at ${connection.deviceInfo.ipAddress}`);

			try {
				// Hama bulbs typically use HTTP API
				const response = await fetch(`http://${connection.deviceInfo.ipAddress}/api/v1/control`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						action: 'toggle'
					}),
					signal: AbortSignal.timeout(3000)
				});

				return response.ok;
			} catch (error) {
				console.error(`Error toggling Hama bulb: ${error}`);
				return false;
			}
		},

		async setBrightness(connection: RealDeviceConnection, brightness: number): Promise<boolean> {
			console.log(
				`Setting Hama bulb brightness to ${brightness}% at ${connection.deviceInfo.ipAddress}`
			);
			return true;
		},

		async setColor(connection: RealDeviceConnection, color: string): Promise<boolean> {
			console.log(`Setting Hama bulb color to ${color} at ${connection.deviceInfo.ipAddress}`);
			return true;
		}
	},

	// Yeelight smart bulb handler
	yeelight: {
		async connect(deviceInfo: DeviceInfo): Promise<RealDeviceConnection> {
			console.log(`Connecting to Yeelight bulb at ${deviceInfo.ipAddress}`);

			try {
				// According to Yeelight Inter-operation Specification:
				// Establish a persistent TCP connection on port 55443
				// First, discover if device has LAN Control enabled via multicast discovery

				// In a real implementation, send a multicast message to 239.255.255.250:1982
				// with M-SEARCH discovery packet

				// For now, we'll simulate a successful connection
				return {
					deviceInfo,
					connectionStatus: 'connected',
					lastCommunicated: new Date(),
					capabilities: ['toggle', 'brightness', 'color', 'temperature', 'name', 'scene']
				};
			} catch (error) {
				console.error(`Failed to connect to Yeelight at ${deviceInfo.ipAddress}:`, error);
				throw error;
			}
		},

		async togglePower(connection: RealDeviceConnection): Promise<boolean> {
			// Yeelight uses JSON-RPC 2.0 protocol over a TCP socket
			console.log(`Toggling Yeelight bulb power at ${connection.deviceInfo.ipAddress}`);

			try {
				// The actual Yeelight protocol format per the specification
				const command = {
					id: 1,
					method: 'toggle',
					params: []
				};

				// In a real implementation, send command over TCP socket
				// For browser environment, simulating with a fetch call to our own API instead of direct
				// This avoids CORS issues
				const response = await fetch(`/api/yeelight/command`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						ipAddress: connection.deviceInfo.ipAddress,
						port: 55443,
						command
					})
				});

				if (response.ok) {
					console.log('Yeelight toggle command successful');
					return true;
				} else {
					// Fallback: Try the alternative API if available
					try {
						const altResponse = await fetch(
							`/api/yeelight/simple?ip=${connection.deviceInfo.ipAddress}&action=toggle`,
							{
								method: 'GET'
							}
						);

						return altResponse.ok;
					} catch (error) {
						console.warn('Alternative toggle method failed:', error);
						return false;
					}
				}
			} catch (error) {
				console.error(`Error toggling Yeelight power: ${error}`);

				// Implement a fallback method
				try {
					const fallbackResponse = await fetch(
						`/api/yeelight/simple?ip=${connection.deviceInfo.ipAddress}&action=toggle`,
						{
							method: 'GET'
						}
					);

					return fallbackResponse.ok;
				} catch (error) {
					console.error('Fallback toggle method also failed', error);
					return false;
				}
			}
		},

		async setPower(
			connection: RealDeviceConnection,
			power: boolean,
			effect: string = 'smooth',
			duration: number = 500
		): Promise<boolean> {
			console.log(
				`Setting Yeelight power to ${power ? 'on' : 'off'} at ${connection.deviceInfo.ipAddress}`
			);

			try {
				// Proper command according to Yeelight spec
				const command = {
					id: 1,
					method: 'set_power',
					params: [power ? 'on' : 'off', effect, duration]
				};

				const response = await fetch(`/api/yeelight/command`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						ipAddress: connection.deviceInfo.ipAddress,
						port: 55443,
						command
					})
				});

				return response.ok;
			} catch (error) {
				console.error(`Error setting Yeelight power: ${error}`);
				return false;
			}
		},

		async setBrightness(
			connection: RealDeviceConnection,
			brightness: number,
			effect: string = 'smooth',
			duration: number = 500
		): Promise<boolean> {
			console.log(
				`Setting Yeelight brightness to ${brightness}% at ${connection.deviceInfo.ipAddress}`
			);

			try {
				// Proper command according to Yeelight spec
				const command = {
					id: 2,
					method: 'set_bright',
					params: [brightness, effect, duration]
				};

				// In a real implementation, this would use a TCP socket
				const response = await fetch(`/api/yeelight/command`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						ipAddress: connection.deviceInfo.ipAddress,
						port: 55443,
						command
					})
				});

				return response.ok;
			} catch (error) {
				console.error(`Error setting Yeelight brightness: ${error}`);
				return false;
			}
		},

		async setColor(
			connection: RealDeviceConnection,
			color: string,
			effect: string = 'smooth',
			duration: number = 500
		): Promise<boolean> {
			console.log(`Setting Yeelight color to ${color} at ${connection.deviceInfo.ipAddress}`);

			try {
				// Convert hex color to RGB
				const r = parseInt(color.substring(1, 3), 16);
				const g = parseInt(color.substring(3, 5), 16);
				const b = parseInt(color.substring(5, 7), 16);

				// Calculate RGB value as per Yeelight spec (r * 65536 + g * 256 + b)
				const rgbValue = r * 65536 + g * 256 + b;

				// Proper command according to Yeelight spec
				const command = {
					id: 3,
					method: 'set_rgb',
					params: [rgbValue, effect, duration]
				};

				const response = await fetch(`/api/yeelight/command`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						ipAddress: connection.deviceInfo.ipAddress,
						port: 55443,
						command
					})
				});

				return response.ok;
			} catch (error) {
				console.error(`Error setting Yeelight color: ${error}`);
				return false;
			}
		},

		async setColorTemperature(
			connection: RealDeviceConnection,
			temperature: number,
			effect: string = 'smooth',
			duration: number = 500
		): Promise<boolean> {
			console.log(
				`Setting Yeelight color temperature to ${temperature}K at ${connection.deviceInfo.ipAddress}`
			);

			try {
				// Ensure temperature is within valid range (1700-6500K)
				const validTemp = Math.max(1700, Math.min(6500, temperature));

				// Proper command according to Yeelight spec
				const command = {
					id: 4,
					method: 'set_ct_abx',
					params: [validTemp, effect, duration]
				};

				const response = await fetch(`/api/yeelight/command`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						ipAddress: connection.deviceInfo.ipAddress,
						port: 55443,
						command
					})
				});

				return response.ok;
			} catch (error) {
				console.error(`Error setting Yeelight color temperature: ${error}`);
				return false;
			}
		},

		async setName(connection: RealDeviceConnection, name: string): Promise<boolean> {
			console.log(`Setting Yeelight name to "${name}" at ${connection.deviceInfo.ipAddress}`);

			try {
				// Proper command according to Yeelight spec
				const command = {
					id: 5,
					method: 'set_name',
					params: [name]
				};

				const response = await fetch(`/api/yeelight/command`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						ipAddress: connection.deviceInfo.ipAddress,
						port: 55443,
						command
					})
				});

				return response.ok;
			} catch (error) {
				console.error(`Error setting Yeelight name: ${error}`);
				return false;
			}
		},

		async setScene(
			connection: RealDeviceConnection,
			sceneClass: string,
			...sceneParams: (number | string)[]
		): Promise<boolean> {
			console.log(`Setting Yeelight scene to ${sceneClass} at ${connection.deviceInfo.ipAddress}`);

			try {
				// Proper command according to Yeelight spec
				const command = {
					id: 6,
					method: 'set_scene',
					params: [sceneClass, ...sceneParams]
				};

				const response = await fetch(`/api/yeelight/command`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						ipAddress: connection.deviceInfo.ipAddress,
						port: 55443,
						command
					})
				});

				return response.ok;
			} catch (error) {
				console.error(`Error setting Yeelight scene: ${error}`);
				return false;
			}
		}
	},

	// Google Nest handler
	googleNest: {
		async connect(deviceInfo: DeviceInfo): Promise<RealDeviceConnection> {
			console.log(`Connecting to Google Nest device at ${deviceInfo.ipAddress}`);

			// Google devices use the Cast protocol
			return {
				deviceInfo,
				connectionStatus: 'connected',
				lastCommunicated: new Date(),
				capabilities: ['toggle', 'volume', 'playback', 'cast']
			};
		},

		async setVolume(connection: RealDeviceConnection, volume: number): Promise<boolean> {
			console.log(`Setting Google Nest volume to ${volume}% at ${connection.deviceInfo.ipAddress}`);
			return true;
		},

		async togglePlayback(connection: RealDeviceConnection): Promise<boolean> {
			console.log(`Toggling Google Nest playback at ${connection.deviceInfo.ipAddress}`);
			return true;
		},

		async castMedia(
			connection: RealDeviceConnection,
			mediaUrl: string,
			contentType: string
		): Promise<boolean> {
			console.log(`Casting media to Google Nest at ${connection.deviceInfo.ipAddress}:`);
			console.log(`URL: ${mediaUrl}, Content Type: ${contentType}`);
			return true;
		}
	},

	// Google TV handler
	googleTV: {
		async connect(deviceInfo: DeviceInfo): Promise<RealDeviceConnection> {
			console.log(`Connecting to Google TV at ${deviceInfo.ipAddress}`);

			return {
				deviceInfo,
				connectionStatus: 'connected',
				lastCommunicated: new Date(),
				capabilities: ['toggle', 'volume', 'playback', 'cast', 'app-launch']
			};
		},

		async setVolume(connection: RealDeviceConnection, volume: number): Promise<boolean> {
			console.log(`Setting Google TV volume to ${volume}% at ${connection.deviceInfo.ipAddress}`);
			return true;
		},

		async togglePlayback(connection: RealDeviceConnection): Promise<boolean> {
			console.log(`Toggling Google TV playback at ${connection.deviceInfo.ipAddress}`);
			return true;
		},

		async launchApp(connection: RealDeviceConnection, appId: string): Promise<boolean> {
			console.log(`Launching app ${appId} on Google TV at ${connection.deviceInfo.ipAddress}`);
			return true;
		}
	},

	// Generic handler for unknown devices
	generic: {
		async connect(deviceInfo: DeviceInfo): Promise<RealDeviceConnection> {
			console.log(`Attempting generic connection to device at ${deviceInfo.ipAddress}`);

			return {
				deviceInfo,
				connectionStatus: 'connected',
				lastCommunicated: new Date(),
				capabilities: ['toggle']
			};
		},

		async sendCommand(
			connection: RealDeviceConnection,
			command: string,
			params: GenericCommandParams
		): Promise<boolean> {
			console.log(
				`Sending generic command ${command} to ${connection.deviceInfo.ipAddress}`,
				params
			);
			return true;
		}
	}
};

// Helper function to create a direct TCP connection to a Yeelight device
// This would need a server component in production
async function connectToYeelight(ipAddress: string): Promise<WebSocket | null> {
	// In a browser environment, we'd use a WebSocket to a server-side proxy
	// For now, we'll just simulate it
	console.log(`Simulating TCP connection to Yeelight at ${ipAddress}:55443`);
	return null;
}

// Manager for real device connections
export const RealDeviceManager = {
	async connectToDevice(deviceInfo: DeviceInfo): Promise<RealDeviceConnection> {
		try {
			let connection: RealDeviceConnection;

			// Choose the right protocol handler based on device type
			switch (deviceInfo.type) {
				case 'hama-bulb':
					connection = await DeviceProtocols.hama.connect(deviceInfo);
					break;

				case 'yeelight-bulb':
					connection = await DeviceProtocols.yeelight.connect(deviceInfo);

					// For Yeelight, attempt to establish a TCP socket connection
					// This is needed for the device to receive commands
					if (connection.connectionStatus === 'connected') {
						const socket = await connectToYeelight(deviceInfo.ipAddress);
						deviceSockets.set(deviceInfo.id, socket);
					}
					break;

				case 'google-nest':
					connection = await DeviceProtocols.googleNest.connect(deviceInfo);
					break;

				case 'google-cast':
				case 'google-tv':
					connection = await DeviceProtocols.googleTV.connect(deviceInfo);
					break;

				default:
					connection = await DeviceProtocols.generic.connect(deviceInfo);
			}

			// Store the connection
			connectedDevicesStore.update((connections) => {
				connections.set(deviceInfo.id, connection);
				return connections;
			});

			return connection;
		} catch (error) {
			const errorConnection: RealDeviceConnection = {
				deviceInfo,
				connectionStatus: 'error',
				lastCommunicated: new Date(),
				errorMessage: error instanceof Error ? error.message : String(error),
				capabilities: []
			};

			// Store the failed connection info
			connectedDevicesStore.update((connections) => {
				connections.set(deviceInfo.id, errorConnection);
				return connections;
			});

			return errorConnection;
		}
	},

	async disconnectFromDevice(deviceId: string): Promise<void> {
		// Clean up any resources
		connectedDevicesStore.update((connections) => {
			if (connections.has(deviceId)) {
				const connection = connections.get(deviceId)!;
				console.log(`Disconnecting from ${connection.deviceInfo.ipAddress}`);

				// Close any open sockets
				if (deviceSockets.has(deviceId)) {
					const socket = deviceSockets.get(deviceId);
					if (socket) {
						// Close the socket if it exists
						socket.close();
					}
					deviceSockets.delete(deviceId);
				}

				// Update the connection status
				connection.connectionStatus = 'disconnected';
				connections.set(deviceId, connection);
			}
			return connections;
		});
	},

	getConnectedDevices(): RealDeviceConnection[] {
		let devices: RealDeviceConnection[] = [];
		connectedDevicesStore.subscribe((connections) => {
			devices = Array.from(connections.values());
		})();
		return devices;
	},

	async executeDeviceAction(
		deviceId: string,
		action: string,
		params: LightParams | AudioDeviceParams | GenericCommandParams
	): Promise<boolean> {
		let result = false;
		let connection: RealDeviceConnection | undefined;

		connectedDevicesStore.subscribe((connections) => {
			connection = connections.get(deviceId);
		})();

		if (!connection || connection.connectionStatus !== 'connected') {
			throw new Error(`Device ${deviceId} is not connected`);
		}

		try {
			switch (connection.deviceInfo.type) {
				case 'hama-bulb':
					if (action === 'toggle') {
						result = await DeviceProtocols.hama.togglePower(connection);
					} else if (action === 'brightness' && 'brightness' in params) {
						result = await DeviceProtocols.hama.setBrightness(
							connection,
							params.brightness as number
						);
					} else if (action === 'color' && 'color' in params) {
						result = await DeviceProtocols.hama.setColor(connection, params.color as string);
					}
					break;

				case 'yeelight-bulb':
					if (action === 'toggle') {
						result = await DeviceProtocols.yeelight.togglePower(connection);
					} else if (action === 'power' && 'power' in params) {
						// Handle direct power on/off with optional effect and duration
						const effect = (params.effect as string) || 'smooth';
						const duration = (params.duration as number) || 500;
						result = await DeviceProtocols.yeelight.setPower(
							connection,
							params.power as boolean,
							effect,
							duration
						);
					} else if (action === 'brightness' && 'brightness' in params) {
						// Handle brightness with optional effect and duration
						const effect = (params.effect as string) || 'smooth';
						const duration = (params.duration as number) || 500;
						result = await DeviceProtocols.yeelight.setBrightness(
							connection,
							params.brightness as number,
							effect,
							duration
						);
					} else if (action === 'color' && 'color' in params) {
						// Handle color with optional effect and duration
						const effect = (params.effect as string) || 'smooth';
						const duration = (params.duration as number) || 500;
						result = await DeviceProtocols.yeelight.setColor(
							connection,
							params.color as string,
							effect,
							duration
						);
					} else if (action === 'temperature' && 'temperature' in params) {
						// Handle color temperature with optional effect and duration
						const effect = (params.effect as string) || 'smooth';
						const duration = (params.duration as number) || 500;
						result = await DeviceProtocols.yeelight.setColorTemperature(
							connection,
							params.temperature as number,
							effect,
							duration
						);
					} else if (action === 'name' && 'name' in params) {
						// Handle device name setting
						result = await DeviceProtocols.yeelight.setName(connection, params.name as string);
					} else if (action === 'scene' && 'class' in params) {
						// Handle scene control
						// Extract parameters for the scene
						const sceneClass = params.class as string;
						const sceneParams: (string | number)[] = [];

						// Add all other parameters as scene parameters
						Object.keys(params).forEach((key) => {
							if (key !== 'class' && key !== 'deviceId' && key !== 'action') {
								sceneParams.push(params[key] as string | number);
							}
						});

						result = await DeviceProtocols.yeelight.setScene(
							connection,
							sceneClass,
							...sceneParams
						);
					}
					break;

				case 'google-nest':
					if (action === 'volume' && 'volume' in params) {
						result = await DeviceProtocols.googleNest.setVolume(
							connection,
							params.volume as number
						);
					} else if (action === 'playback') {
						result = await DeviceProtocols.googleNest.togglePlayback(connection);
					} else if (
						action === 'cast' &&
						params &&
						'mediaUrl' in params &&
						'contentType' in params
					) {
						result = await DeviceProtocols.googleNest.castMedia(
							connection,
							params.mediaUrl as string,
							params.contentType as string
						);
					}
					break;

				case 'google-cast':
				case 'google-tv':
					if (action === 'volume' && 'volume' in params) {
						result = await DeviceProtocols.googleTV.setVolume(connection, params.volume as number);
					} else if (action === 'playback') {
						result = await DeviceProtocols.googleTV.togglePlayback(connection);
					} else if (action === 'launch-app' && params && 'appId' in params) {
						result = await DeviceProtocols.googleTV.launchApp(connection, params.appId as string);
					}
					break;

				default:
					result = await DeviceProtocols.generic.sendCommand(
						connection,
						action,
						params as GenericCommandParams
					);
			}

			// Update last communication time
			if (result) {
				connectedDevicesStore.update((connections) => {
					if (connections.has(deviceId)) {
						const conn = connections.get(deviceId)!;
						conn.lastCommunicated = new Date();
						connections.set(deviceId, conn);
					}
					return connections;
				});
			}

			return result;
		} catch (error) {
			console.error(`Error executing action ${action} on device ${deviceId}:`, error);

			// Update connection with error
			connectedDevicesStore.update((connections) => {
				if (connections.has(deviceId)) {
					const conn = connections.get(deviceId)!;
					conn.errorMessage = error instanceof Error ? error.message : String(error);
					connections.set(deviceId, conn);
				}
				return connections;
			});

			return false;
		}
	},

	// Map discovered devices to our Device model
	mapToDeviceModel(connection: RealDeviceConnection): Device | null {
		const { deviceInfo } = connection;
		const type = deviceInfo.type || 'unknown';

		// Mapping of device types
		if (type === 'hama-bulb' || type === 'yeelight-bulb' || type.includes('light')) {
			const bulb: SmartBulb = {
				id: deviceInfo.id,
				name: deviceInfo.name || 'Unknown Light',
				type: 'bulb',
				status: true, // We'd get the actual status from the device
				brightness: 75, // Default until we get real data
				location: 'Network', // Could be determined from device info or user config
				lastUpdated: 'Just now'
			};
			return bulb;
		} else if (type === 'google-nest' || type === 'google-cast' || type === 'google-tv') {
			const audio: NestAudio = {
				id: deviceInfo.id,
				name: deviceInfo.name || 'Unknown Speaker',
				type: 'nest',
				status: true,
				volume: 50, // Default until we get real data
				location: 'Network',
				lastUpdated: 'Just now',
				isPlaying: false
			};
			return audio;
		}

		return null; // Device type not supported by our model
	}
};
