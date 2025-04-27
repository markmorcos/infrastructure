<script lang="ts">
	import { onMount } from 'svelte';
	import {
		deviceStore,
		DeviceAPI,
		sceneStore,
		SceneAPI,
		type Device,
		type SmartBulb,
		type NestAudio,
		type Scene
	} from '$lib/api/devices';

	let devices: Device[] = [];
	let scenes: Scene[] = [];
	let loading = true;

	// Subscribe to the device store
	$: devices = $deviceStore;
	$: scenes = $sceneStore;
	$: devicesByLocation = DeviceAPI.groupDevicesByLocation();
	$: locations = Object.keys(devicesByLocation);

	onMount(async () => {
		try {
			await Promise.all([DeviceAPI.getAllDevices(), SceneAPI.getAllScenes()]);
			loading = false;
		} catch (error) {
			console.error('Failed to load initial data:', error);
			loading = false;
		}
	});

	async function toggleDevice(id: string) {
		try {
			await DeviceAPI.toggleDevice(id);
		} catch (error) {
			console.error(`Failed to toggle device ${id}:`, error);
		}
	}

	async function updateBrightness(id: string, value: number) {
		try {
			await DeviceAPI.updateBulbBrightness(id, value);
		} catch (error) {
			console.error(`Failed to update brightness for device ${id}:`, error);
		}
	}

	async function updateVolume(id: string, value: number) {
		try {
			await DeviceAPI.updateNestVolume(id, value);
		} catch (error) {
			console.error(`Failed to update volume for device ${id}:`, error);
		}
	}

	async function togglePlayback(id: string) {
		try {
			await DeviceAPI.toggleNestPlayback(id);
		} catch (error) {
			console.error(`Failed to toggle playback for device ${id}:`, error);
		}
	}

	async function activateScene(id: string) {
		try {
			await SceneAPI.activateScene(id);
		} catch (error) {
			console.error(`Failed to activate scene ${id}:`, error);
		}
	}

	// Get active quick actions
	$: quickActions = scenes.map((scene) => ({
		id: scene.id,
		name: scene.name,
		icon: scene.icon,
		active: scene.active
	}));
</script>

<div class="space-y-6">
	<header
		class="flex items-center justify-between border-b border-gray-200 pb-5 dark:border-gray-700"
	>
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
			<p class="mt-1 text-gray-500 dark:text-gray-400">
				Monitor and control your smart home devices
			</p>
		</div>
		<a
			href="/devices"
			class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
		>
			Network Devices
		</a>
	</header>

	{#if loading}
		<div class="flex justify-center py-10">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-indigo-600"></div>
		</div>
	{:else}
		<!-- Quick Actions -->
		<section>
			<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Scenes</h2>
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
				{#each quickActions as action}
					<button
						class={`flex flex-col items-center justify-center rounded-lg p-4 shadow-sm transition ${action.active ? 'bg-indigo-50 dark:bg-indigo-900' : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'}`}
						on:click={() => activateScene(action.id)}
					>
						{#if action.icon === 'movie'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class={`mb-2 h-10 w-10 ${action.active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
								<line x1="7" y1="2" x2="7" y2="22"></line>
								<line x1="17" y1="2" x2="17" y2="22"></line>
								<line x1="2" y1="12" x2="22" y2="12"></line>
								<line x1="2" y1="7" x2="7" y2="7"></line>
								<line x1="2" y1="17" x2="7" y2="17"></line>
								<line x1="17" y1="17" x2="22" y2="17"></line>
								<line x1="17" y1="7" x2="22" y2="7"></line>
							</svg>
						{:else if action.icon === 'book'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class={`mb-2 h-10 w-10 ${action.active ? 'text-indigo-600 dark:text-indigo-400' : 'text-green-500 dark:text-green-400'}`}
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
								<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
							</svg>
						{:else if action.icon === 'moon'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class={`mb-2 h-10 w-10 ${action.active ? 'text-indigo-600 dark:text-indigo-400' : 'text-blue-500 dark:text-blue-400'}`}
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
							</svg>
						{/if}
						<span
							class={`text-sm font-medium ${action.active ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}
							>{action.name}</span
						>
					</button>
				{/each}
			</div>
		</section>

		<!-- Rooms Section -->
		<section>
			<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Devices</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each locations as location}
					<div class="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
						<h3 class="mb-4 text-lg font-medium text-gray-900 dark:text-white">{location}</h3>
						<div class="space-y-4">
							{#each devicesByLocation[location] as device}
								<div class="rounded-md border border-gray-200 p-3 dark:border-gray-700">
									<div class="flex items-center justify-between">
										<div class="flex items-center">
											{#if device.type === 'bulb'}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class={`mr-3 h-6 w-6 ${device.status ? 'text-yellow-500' : 'text-gray-400'}`}
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<path
														d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"
													></path>
													<path d="M9 18h6"></path>
													<path d="M10 22h4"></path>
												</svg>
											{:else if device.type === 'nest'}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="mr-3 h-6 w-6 text-blue-500"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<circle cx="12" cy="12" r="10"></circle>
													<circle cx="12" cy="12" r="4"></circle>
													<line x1="4.93" y1="4.93" x2="9.17" y2="9.17"></line>
													<line x1="14.83" y1="14.83" x2="19.07" y2="19.07"></line>
													<line x1="14.83" y1="9.17" x2="19.07" y2="4.93"></line>
													<line x1="14.83" y1="9.17" x2="18.36" y2="5.64"></line>
													<line x1="4.93" y1="19.07" x2="9.17" y2="14.83"></line>
												</svg>
											{/if}
											<div>
												<span class="font-medium text-gray-700 dark:text-gray-300"
													>{device.name}</span
												>
												{#if device.type === 'bulb' && device.group}
													<span class="ml-2 text-xs text-gray-500 dark:text-gray-400"
														>({device.group})</span
													>
												{/if}
											</div>
										</div>
										<label class="relative inline-flex cursor-pointer items-center">
											<input
												type="checkbox"
												class="peer sr-only"
												checked={device.status}
												on:change={() => toggleDevice(device.id)}
											/>
											<div
												class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
											></div>
										</label>
									</div>
									{#if device.type === 'bulb' && device.status}
										<div class="mt-3">
											<label
												for={`brightness-${device.id}`}
												class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-400"
											>
												Brightness: {device.brightness}%
											</label>
											<input
												id={`brightness-${device.id}`}
												type="range"
												min="0"
												max="100"
												value={device.brightness}
												class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
												on:input={(e) =>
													updateBrightness(
														device.id,
														parseInt((e.target as HTMLInputElement).value)
													)}
											/>
										</div>
									{:else if device.type === 'nest'}
										<div class="mt-3">
											<div class="flex items-center justify-between">
												<div>
													<label
														for={`volume-${device.id}`}
														class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-400"
													>
														Volume: {device.volume}%
													</label>
													<input
														id={`volume-${device.id}`}
														type="range"
														min="0"
														max="100"
														value={device.volume}
														class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
														on:input={(e) =>
															updateVolume(
																device.id,
																parseInt((e.target as HTMLInputElement).value)
															)}
													/>
												</div>
											</div>
											<div class="mt-2 flex justify-center">
												<button
													class="flex items-center justify-center rounded-full bg-indigo-100 p-2 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-800"
													on:click={() => togglePlayback(device.id)}
												>
													{#if device.isPlaying}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															class="h-6 w-6"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
															stroke-linecap="round"
															stroke-linejoin="round"
														>
															<rect x="6" y="4" width="4" height="16"></rect>
															<rect x="14" y="4" width="4" height="16"></rect>
														</svg>
													{:else}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															class="h-6 w-6"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
															stroke-linecap="round"
															stroke-linejoin="round"
														>
															<polygon points="5 3 19 12 5 21 5 3"></polygon>
														</svg>
													{/if}
												</button>
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>
