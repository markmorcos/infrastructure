import { writable } from 'svelte/store';
import { DeviceProtocols } from './realDevices';

// Device types
export type SmartBulb = {
	id: string;
	name: string;
	type: 'bulb';
	status: boolean;
	brightness: number;
	color?: string;
	temperature?: number; // Color temperature in Kelvin (1700-6500)
	location: string;
	lastUpdated: string;
	group?: string;
};

export type NestAudio = {
	id: string;
	name: string;
	type: 'nest';
	status: boolean;
	volume: number;
	location: string;
	lastUpdated: string;
	isPlaying: boolean;
};

export type Device = SmartBulb | NestAudio;

// Initial device data
const initialDevices: Device[] = [
	{
		id: 'yeelight-1',
		name: 'Ceiling Lamp',
		type: 'bulb',
		status: true,
		brightness: 75,
		location: 'Bedroom',
		lastUpdated: 'Just now'
	}
	// {
	// 	id: 'bulb-1',
	// 	name: 'Standing Lamp Bulb 1',
	// 	type: 'bulb',
	// 	status: true,
	// 	brightness: 75,
	// 	location: 'Bedroom',
	// 	lastUpdated: '2 mins ago',
	// 	group: 'Standing Lamp'
	// },
	// {
	// 	id: 'bulb-2',
	// 	name: 'Standing Lamp Bulb 2',
	// 	type: 'bulb',
	// 	status: true,
	// 	brightness: 75,
	// 	location: 'Bedroom',
	// 	lastUpdated: '2 mins ago',
	// 	group: 'Standing Lamp'
	// },
	// {
	// 	id: 'bulb-3',
	// 	name: 'Standing Lamp Bulb 3',
	// 	type: 'bulb',
	// 	status: true,
	// 	brightness: 75,
	// 	location: 'Bedroom',
	// 	lastUpdated: '2 mins ago',
	// 	group: 'Standing Lamp'
	// },
	// {
	// 	id: 'nest-1',
	// 	name: 'Google Nest Audio',
	// 	type: 'nest',
	// 	status: true,
	// 	volume: 50,
	// 	location: 'Bedroom',
	// 	lastUpdated: '5 mins ago',
	// 	isPlaying: false
	// }
];

// Device store
export const deviceStore = writable<Device[]>(initialDevices);

// Mock API functions that would normally communicate with real devices
export const DeviceAPI = {
	getAllDevices: async (): Promise<Device[]> => {
		// In a real app, this would fetch from an API
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve([...initialDevices]);
			}, 300);
		});
	},

	toggleDevice: async (id: string): Promise<Device> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				deviceStore.update((devices) => {
					const device = devices.find((d) => d.id === id);
					if (!device) throw new Error(`Device with ID ${id} not found`);
					console.log('device', device);

					// Create a fake connection object for the API call
					const connection = {
						deviceInfo: {
							id: device.id,
							ipAddress: '192.168.188.185',
							name: device.name,
							type: device.type,
							manufacturerInfo: 'Yeelight',
							mac: '54:48:E6:66:11:41'
						},
						connectionStatus: 'connected' as 'connected' | 'disconnected' | 'error',
						lastCommunicated: new Date(),
						capabilities: ['toggle', 'brightness', 'color', 'temperature', 'name', 'scene']
					};

					// Use the new Yeelight API methods
					if (device.type === 'bulb') {
						if (device.status) {
							// Turn off with smooth transition
							DeviceProtocols.yeelight.setPower(connection, false, 'smooth', 500);
						} else {
							// Turn on with smooth transition
							DeviceProtocols.yeelight.setPower(connection, true, 'smooth', 500);
							// Set a default brightness when turning on
							DeviceProtocols.yeelight.setBrightness(connection, 75, 'smooth', 500);
						}
					} else {
						// Use toggle for non-bulb devices
						DeviceProtocols.yeelight.togglePower(connection);
					}

					const updatedDevice = { ...device, status: !device.status, lastUpdated: 'Just now' };

					// If it's a bulb and we're turning it on, set brightness to 75
					if (updatedDevice.type === 'bulb' && updatedDevice.status) {
						updatedDevice.brightness = 75;
					} else if (updatedDevice.type === 'bulb' && !updatedDevice.status) {
						updatedDevice.brightness = 0;
					}

					const updatedDevices = devices.map((d) => (d.id === id ? updatedDevice : d));
					return updatedDevices;
				});

				// Get updated device
				let updatedDevice: Device | undefined;
				deviceStore.subscribe((devices) => {
					updatedDevice = devices.find((d) => d.id === id);
				})();

				resolve(updatedDevice as Device);
			}, 300);
		});
	},

	updateBulbBrightness: async (id: string, brightness: number): Promise<Device> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				deviceStore.update((devices) => {
					const device = devices.find((d) => d.id === id);
					if (device && device.type === 'bulb') {
						// Create connection object for API call
						const connection = {
							deviceInfo: {
								id: device.id,
								ipAddress: '192.168.188.185',
								name: device.name,
								type: device.type,
								manufacturerInfo: 'Yeelight',
								mac: '54:48:E6:66:11:41'
							},
							connectionStatus: 'connected' as 'connected' | 'disconnected' | 'error',
							lastCommunicated: new Date(),
							capabilities: ['toggle', 'brightness', 'color', 'temperature', 'name', 'scene']
						};

						// If brightness is 0, turn off the device
						if (brightness === 0) {
							DeviceProtocols.yeelight.setPower(connection, false, 'smooth', 300);
						} else {
							// First ensure the device is on, then set brightness
							if (!device.status) {
								DeviceProtocols.yeelight.setPower(connection, true, 'sudden', 0);
							}
							// Then set the brightness with smooth transition
							DeviceProtocols.yeelight.setBrightness(connection, brightness, 'smooth', 300);
						}
					}

					return devices.map((device) => {
						if (device.id === id && device.type === 'bulb') {
							return {
								...device,
								brightness,
								status: brightness > 0,
								lastUpdated: 'Just now'
							};
						}
						return device;
					});
				});

				// Get updated device
				let updatedDevice: Device | undefined;
				deviceStore.subscribe((devices) => {
					updatedDevice = devices.find((d) => d.id === id);
				})();

				resolve(updatedDevice as Device);
			}, 300);
		});
	},

	updateBulbColor: async (id: string, color: string): Promise<Device> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				deviceStore.update((devices) => {
					const device = devices.find((d) => d.id === id);
					if (device && device.type === 'bulb') {
						// Create connection object for API call
						const connection = {
							deviceInfo: {
								id: device.id,
								ipAddress: '192.168.188.185',
								name: device.name,
								type: device.type,
								manufacturerInfo: 'Yeelight',
								mac: '54:48:E6:66:11:41'
							},
							connectionStatus: 'connected' as 'connected' | 'disconnected' | 'error',
							lastCommunicated: new Date(),
							capabilities: ['toggle', 'brightness', 'color', 'temperature', 'name', 'scene']
						};

						// Ensure the device is on before changing color
						if (!device.status) {
							DeviceProtocols.yeelight.setPower(connection, true, 'sudden', 0);
						}

						// Set the color with smooth transition
						DeviceProtocols.yeelight.setColor(connection, color, 'smooth', 500);
					}

					return devices.map((device) => {
						if (device.id === id && device.type === 'bulb') {
							return {
								...device,
								color,
								status: true, // Setting a color implies the light is on
								lastUpdated: 'Just now'
							};
						}
						return device;
					});
				});

				// Get updated device
				let updatedDevice: Device | undefined;
				deviceStore.subscribe((devices) => {
					updatedDevice = devices.find((d) => d.id === id);
				})();

				resolve(updatedDevice as Device);
			}, 300);
		});
	},

	updateBulbTemperature: async (id: string, temperature: number): Promise<Device> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				deviceStore.update((devices) => {
					const device = devices.find((d) => d.id === id);
					if (device && device.type === 'bulb') {
						// Create connection object for API call
						const connection = {
							deviceInfo: {
								id: device.id,
								ipAddress: '192.168.188.185',
								name: device.name,
								type: device.type,
								manufacturerInfo: 'Yeelight',
								mac: '54:48:E6:66:11:41'
							},
							connectionStatus: 'connected' as 'connected' | 'disconnected' | 'error',
							lastCommunicated: new Date(),
							capabilities: ['toggle', 'brightness', 'color', 'temperature', 'name', 'scene']
						};

						// Ensure the device is on before changing temperature
						if (!device.status) {
							DeviceProtocols.yeelight.setPower(connection, true, 'sudden', 0);
						}

						// Set the color temperature with smooth transition
						// Yeelight supports 1700K (warm) to 6500K (cool)
						const validTemp = Math.max(1700, Math.min(6500, temperature));
						DeviceProtocols.yeelight.setColorTemperature(connection, validTemp, 'smooth', 500);
					}

					return devices.map((device) => {
						if (device.id === id && device.type === 'bulb') {
							return {
								...device,
								temperature, // Add temperature to device state
								status: true, // Setting a temperature implies the light is on
								lastUpdated: 'Just now'
							};
						}
						return device;
					});
				});

				// Get updated device
				let updatedDevice: Device | undefined;
				deviceStore.subscribe((devices) => {
					updatedDevice = devices.find((d) => d.id === id);
				})();

				resolve(updatedDevice as Device);
			}, 300);
		});
	},

	updateNestVolume: async (id: string, volume: number): Promise<Device> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				deviceStore.update((devices) => {
					return devices.map((device) => {
						if (device.id === id && device.type === 'nest') {
							return {
								...device,
								volume,
								lastUpdated: 'Just now'
							};
						}
						return device;
					});
				});

				// Get updated device
				let updatedDevice: Device | undefined;
				deviceStore.subscribe((devices) => {
					updatedDevice = devices.find((d) => d.id === id);
				})();

				resolve(updatedDevice as Device);
			}, 300);
		});
	},

	toggleNestPlayback: async (id: string): Promise<Device> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				deviceStore.update((devices) => {
					return devices.map((device) => {
						if (device.id === id && device.type === 'nest') {
							return {
								...device,
								isPlaying: !device.isPlaying,
								lastUpdated: 'Just now'
							};
						}
						return device;
					});
				});

				// Get updated device
				let updatedDevice: Device | undefined;
				deviceStore.subscribe((devices) => {
					updatedDevice = devices.find((d) => d.id === id);
				})();

				resolve(updatedDevice as Device);
			}, 300);
		});
	},

	groupDevicesByLocation(): Record<string, Device[]> {
		const grouped: Record<string, Device[]> = {};

		let devices: Device[] = [];
		deviceStore.subscribe((d) => (devices = d))();

		devices.forEach((device) => {
			if (!grouped[device.location]) {
				grouped[device.location] = [];
			}
			grouped[device.location].push(device);
		});

		return grouped;
	},

	// Add or update a device in the store
	addOrUpdateDevice: async (device: Device): Promise<Device> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				deviceStore.update((devices) => {
					// Check if the device already exists
					const existingIndex = devices.findIndex((d) => d.id === device.id);

					if (existingIndex >= 0) {
						// Update existing device
						const updatedDevices = [...devices];
						updatedDevices[existingIndex] = {
							...device,
							lastUpdated: 'Just now'
						};
						return updatedDevices;
					} else {
						// Add new device
						return [
							...devices,
							{
								...device,
								lastUpdated: 'Just now'
							}
						];
					}
				});

				// Return the added/updated device
				let updatedDevice: Device | undefined;
				deviceStore.subscribe((devices) => {
					updatedDevice = devices.find((d) => d.id === device.id);
				})();

				resolve(updatedDevice as Device);
			}, 300);
		});
	}
};

// Scene functionality
export type Scene = {
	id: string;
	name: string;
	icon: string;
	description: string;
	deviceSettings: DeviceSetting[];
	active: boolean;
};

type DeviceSetting = {
	deviceId: string;
	status: boolean;
	brightness?: number;
	color?: string;
	temperature?: number;
	volume?: number;
};

export const sceneStore = writable<Scene[]>([
	{
		id: 'scene-1',
		name: 'Movie Night',
		icon: 'movie',
		description: 'Dim the lights for movie watching',
		deviceSettings: [
			{ deviceId: 'bulb-1', status: true, brightness: 30 },
			{ deviceId: 'bulb-2', status: true, brightness: 30 },
			{ deviceId: 'bulb-3', status: true, brightness: 30 },
			{ deviceId: 'bulb-4', status: false },
			{ deviceId: 'nest-1', status: true, volume: 80 }
		],
		active: false
	},
	{
		id: 'scene-2',
		name: 'Reading Mode',
		icon: 'book',
		description: 'Bright light for comfortable reading',
		deviceSettings: [
			{ deviceId: 'bulb-1', status: true, brightness: 100 },
			{ deviceId: 'bulb-2', status: true, brightness: 100 },
			{ deviceId: 'bulb-3', status: true, brightness: 100 },
			{ deviceId: 'bulb-4', status: false },
			{ deviceId: 'nest-1', status: false }
		],
		active: false
	},
	{
		id: 'scene-3',
		name: 'Good Night',
		icon: 'moon',
		description: 'Turn off all lights for bedtime',
		deviceSettings: [
			{ deviceId: 'bulb-1', status: false },
			{ deviceId: 'bulb-2', status: false },
			{ deviceId: 'bulb-3', status: false },
			{ deviceId: 'bulb-4', status: false },
			{ deviceId: 'nest-1', status: false }
		],
		active: true
	}
]);

export const SceneAPI = {
	getAllScenes: async (): Promise<Scene[]> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				let scenes: Scene[] = [];
				sceneStore.subscribe((s) => (scenes = s))();
				resolve([...scenes]);
			}, 300);
		});
	},

	activateScene: async (id: string): Promise<void> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				// First, update the scene status
				sceneStore.update((scenes) =>
					scenes.map((scene) => ({
						...scene,
						active: scene.id === id
					}))
				);

				// Then, get the scene settings to apply
				let sceneToActivate: Scene | undefined;
				sceneStore.subscribe((scenes) => {
					sceneToActivate = scenes.find((s) => s.id === id);
				})();

				if (!sceneToActivate) throw new Error(`Scene with ID ${id} not found`);

				// Apply the scene settings to devices
				deviceStore.update((devices) => {
					// Process updates for devices in the scene
					return devices.map((device) => {
						const setting = sceneToActivate!.deviceSettings.find((s) => s.deviceId === device.id);
						if (!setting) return device;

						// Create a connection for API calls if needed
						const connection = {
							deviceInfo: {
								id: device.id,
								ipAddress: '192.168.188.185',
								name: device.name,
								type: device.type,
								manufacturerInfo: device.type === 'bulb' ? 'Yeelight' : 'Google',
								mac: '54:48:E6:66:11:41'
							},
							connectionStatus: 'connected' as 'connected' | 'disconnected' | 'error',
							lastCommunicated: new Date(),
							capabilities: ['toggle', 'brightness', 'color', 'temperature', 'name', 'scene']
						};

						if (device.type === 'bulb') {
							// If device is a bulb, use Yeelight protocol
							if (setting.status) {
								// Turn on with specified settings if status is true
								DeviceProtocols.yeelight.setPower(connection, true, 'smooth', 500);

								// Set brightness if specified
								if (setting.brightness !== undefined) {
									DeviceProtocols.yeelight.setBrightness(
										connection,
										setting.brightness,
										'smooth',
										500
									);
								}

								// Set color if specified
								if (setting.color) {
									DeviceProtocols.yeelight.setColor(connection, setting.color, 'smooth', 500);
								}

								// Set temperature if specified
								if (setting.temperature) {
									DeviceProtocols.yeelight.setColorTemperature(
										connection,
										setting.temperature,
										'smooth',
										500
									);
								}
							} else {
								// Turn off if status is false
								DeviceProtocols.yeelight.setPower(connection, false, 'smooth', 500);
							}

							return {
								...device,
								status: setting.status,
								brightness: setting.status ? (setting.brightness ?? device.brightness) : 0,
								color: setting.color ?? device.color,
								temperature: setting.temperature ?? device.temperature,
								lastUpdated: 'Just now'
							};
						} else if (device.type === 'nest') {
							return {
								...device,
								status: setting.status,
								volume: setting.volume ?? device.volume,
								lastUpdated: 'Just now'
							};
						}

						return device;
					});
				});

				resolve();
			}, 500);
		});
	}
};
