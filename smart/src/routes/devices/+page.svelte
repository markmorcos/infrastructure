<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { NetworkDiscovery, type DeviceInfo } from '$lib/api/networkDiscovery';
	import { RealDeviceManager, type RealDeviceConnection } from '$lib/api/realDevices';
	import { DeviceAPI, type Device } from '$lib/api/devices';

	// Discovery states
	let isScanning = false;
	let scanError: string | null = null;
	let discoveredDevices: DeviceInfo[] = [];
	let connectedDevices: RealDeviceConnection[] = [];

	// UI states
	let selectedDevice: DeviceInfo | null = null;
	let connectionInProgress = false;
	let connectionSuccess = false;
	let connectionError = '';

	// Reference to interval timer
	let refreshTimer: number;

	onMount(async () => {
		// Start initial scan
		await startNetworkScan();

		// Set up a refresh timer for connections
		refreshTimer = window.setInterval(() => {
			connectedDevices = RealDeviceManager.getConnectedDevices();
		}, 5000);
	});

	onDestroy(() => {
		// Clean up the timer
		if (refreshTimer) {
			clearInterval(refreshTimer);
		}
	});

	async function startNetworkScan() {
		try {
			isScanning = true;
			scanError = null;

			await NetworkDiscovery.startDiscovery();
			discoveredDevices = NetworkDiscovery.getDiscoveredDevices();
		} catch (error) {
			scanError = error instanceof Error ? error.message : String(error);
			console.error('Network scan error:', error);
		} finally {
			isScanning = false;
		}
	}

	async function connectToDevice(device: DeviceInfo) {
		if (connectionInProgress) return;

		try {
			selectedDevice = device;
			connectionInProgress = true;
			connectionSuccess = false;
			connectionError = '';

			// Test connection first
			const canConnect = await NetworkDiscovery.testDeviceConnection(device.ipAddress);

			if (!canConnect) {
				throw new Error(`Could not reach device at ${device.ipAddress}`);
			}

			// Then establish a full connection
			const connection = await RealDeviceManager.connectToDevice(device);

			if (connection.connectionStatus === 'error') {
				throw new Error(connection.errorMessage || 'Unknown connection error');
			}

			// Refresh connected devices list
			connectedDevices = RealDeviceManager.getConnectedDevices();

			// Map to our device model and add to store if applicable
			const deviceModel = RealDeviceManager.mapToDeviceModel(connection);
			if (deviceModel) {
				await DeviceAPI.addOrUpdateDevice(deviceModel);
			}

			connectionSuccess = true;
		} catch (error) {
			connectionError = error instanceof Error ? error.message : String(error);
			console.error('Connection error:', error);
		} finally {
			connectionInProgress = false;
		}
	}

	async function disconnectDevice(deviceId: string) {
		try {
			await RealDeviceManager.disconnectFromDevice(deviceId);
			connectedDevices = RealDeviceManager.getConnectedDevices();
		} catch (error) {
			console.error('Error disconnecting device:', error);
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'connected':
				return 'text-green-500';
			case 'disconnected':
				return 'text-gray-500';
			case 'error':
				return 'text-red-500';
			default:
				return 'text-yellow-500';
		}
	}
</script>

<div class="space-y-6">
	<header class="border-b border-gray-200 pb-5 dark:border-gray-700">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Device Network</h1>
		<p class="mt-1 text-gray-500 dark:text-gray-400">
			Discover and connect to smart devices on your network
		</p>
	</header>

	<section>
		<div class="flex items-center justify-between">
			<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Device Discovery</h2>
			<button
				class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
				on:click={startNetworkScan}
				disabled={isScanning}
			>
				{isScanning ? 'Scanning...' : 'Scan Network'}
			</button>
		</div>

		{#if scanError}
			<div
				class="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900 dark:text-red-300"
			>
				<p>Error scanning network: {scanError}</p>
			</div>
		{/if}

		<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-800">
					<tr>
						<th
							scope="col"
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
						>
							Device
						</th>
						<th
							scope="col"
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
						>
							IP Address
						</th>
						<th
							scope="col"
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
						>
							Type
						</th>
						<th
							scope="col"
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
						>
							Manufacturer
						</th>
						<th
							scope="col"
							class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
						>
							Action
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
					{#if isScanning}
						<tr>
							<td
								colspan="5"
								class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
							>
								<div class="flex items-center justify-center">
									<div
										class="mr-2 h-5 w-5 animate-spin rounded-full border-b-2 border-indigo-600"
									></div>
									Scanning for devices...
								</div>
							</td>
						</tr>
					{:else if discoveredDevices.length === 0}
						<tr>
							<td
								colspan="5"
								class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
							>
								No devices found. Try scanning again.
							</td>
						</tr>
					{:else}
						{#each discoveredDevices as device}
							<tr>
								<td
									class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white"
								>
									{device.name || 'Unnamed Device'}
								</td>
								<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
									{device.ipAddress}
								</td>
								<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
									{device.type || 'Unknown'}
								</td>
								<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
									{device.manufacturerInfo || 'Unknown'}
								</td>
								<td class="whitespace-nowrap px-6 py-4 text-sm">
									<button
										class="rounded bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-800"
										on:click={() => connectToDevice(device)}
									>
										Connect
									</button>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</section>

	{#if selectedDevice && (connectionInProgress || connectionSuccess || connectionError)}
		<div
			class="mt-4 rounded-md border p-4 {connectionSuccess
				? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900'
				: connectionError
					? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900'
					: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900'}"
		>
			<h3
				class="text-md font-medium {connectionSuccess
					? 'text-green-800 dark:text-green-300'
					: connectionError
						? 'text-red-800 dark:text-red-300'
						: 'text-yellow-800 dark:text-yellow-300'}"
			>
				Connection to {selectedDevice.name || selectedDevice.ipAddress}
			</h3>

			{#if connectionInProgress}
				<p class="mt-2 flex items-center text-sm text-yellow-700 dark:text-yellow-400">
					<span class="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-yellow-400"></span>
					Connecting...
				</p>
			{:else if connectionSuccess}
				<p class="mt-2 text-sm text-green-700 dark:text-green-400">
					Successfully connected to device.
				</p>
			{:else if connectionError}
				<p class="mt-2 text-sm text-red-700 dark:text-red-400">
					Failed to connect: {connectionError}
				</p>
			{/if}
		</div>
	{/if}

	<section>
		<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Connected Devices</h2>

		{#if connectedDevices.length === 0}
			<div
				class="rounded-md bg-gray-50 p-4 text-center text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-400"
			>
				No devices connected. Discover and connect to devices above.
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each connectedDevices as connection}
					<div
						class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
					>
						<div class="flex items-center justify-between">
							<h3 class="text-lg font-medium text-gray-900 dark:text-white">
								{connection.deviceInfo.name || 'Unknown Device'}
							</h3>
							<span class={getStatusColor(connection.connectionStatus)}> ● </span>
						</div>

						<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
							{connection.deviceInfo.ipAddress}
						</p>

						{#if connection.deviceInfo.manufacturerInfo}
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-500">
								{connection.deviceInfo.manufacturerInfo}
							</p>
						{/if}

						<div class="mt-3">
							<div class="text-xs text-gray-500 dark:text-gray-500">
								Last communication: {connection.lastCommunicated.toLocaleTimeString()}
							</div>

							<div class="mt-1 text-xs text-gray-500 dark:text-gray-500">
								Capabilities: {connection.capabilities.join(', ')}
							</div>

							{#if connection.errorMessage}
								<div class="mt-2 text-xs text-red-500">
									Error: {connection.errorMessage}
								</div>
							{/if}
						</div>

						<div class="mt-4 flex justify-end">
							<button
								class="rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
								on:click={() => disconnectDevice(connection.deviceInfo.id)}
							>
								Disconnect
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>
