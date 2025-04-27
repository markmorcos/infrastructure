<script lang="ts">
	type IntegrationStatus = 'connected' | 'disconnected' | 'error';

	type Integration = {
		id: number;
		name: string;
		status: IntegrationStatus;
		lastSync?: string;
		icon: string;
	};

	let integrations: Integration[] = [
		{
			id: 1,
			name: 'Google Nest',
			status: 'connected',
			lastSync: '5 mins ago',
			icon: 'nest'
		},
		{
			id: 2,
			name: 'Phillips Hue',
			status: 'connected',
			lastSync: '10 mins ago',
			icon: 'hue'
		},
		{
			id: 3,
			name: 'LIFX',
			status: 'disconnected',
			icon: 'lifx'
		}
	];

	type NotificationSetting = {
		id: number;
		name: string;
		description: string;
		enabled: boolean;
	};

	let notificationSettings: NotificationSetting[] = [
		{
			id: 1,
			name: 'Device Status Changes',
			description: 'Get notified when a device goes offline or comes back online',
			enabled: true
		},
		{
			id: 2,
			name: 'Scene Activations',
			description: 'Get notified when a scene is activated',
			enabled: false
		},
		{
			id: 3,
			name: 'Motion Detected',
			description: 'Get notified when motion is detected by sensors',
			enabled: true
		}
	];

	function toggleNotification(id: number): void {
		notificationSettings = notificationSettings.map((setting) =>
			setting.id === id ? { ...setting, enabled: !setting.enabled } : setting
		);
	}
</script>

<div class="space-y-6">
	<header class="border-b border-gray-200 pb-5 dark:border-gray-700">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
		<p class="mt-1 text-gray-500 dark:text-gray-400">
			Manage your smart home preferences and integrations
		</p>
	</header>

	<!-- Integrations -->
	<section>
		<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Integrations</h2>

		<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
			<div class="bg-gray-50 px-6 py-4 dark:bg-gray-800">
				<h3 class="text-base font-medium text-gray-900 dark:text-white">Connected Services</h3>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					Manage your smart home service connections
				</p>
			</div>
			<div
				class="divide-y divide-gray-200 border-t border-gray-200 dark:divide-gray-700 dark:border-gray-700"
			>
				{#each integrations as integration}
					<div class="flex items-center justify-between bg-white px-6 py-4 dark:bg-gray-900">
						<div class="flex items-center">
							{#if integration.icon === 'nest'}
								<div
									class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-gray-800"
								>
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
										<path
											d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
										></path>
									</svg>
								</div>
							{:else if integration.icon === 'hue'}
								<div
									class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-gray-800"
								>
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
										<path
											d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"
										></path>
										<path d="M9 18h6"></path>
										<path d="M10 22h4"></path>
									</svg>
								</div>
							{:else if integration.icon === 'lifx'}
								<div
									class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-gray-800"
								>
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
										<path
											d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"
										></path>
										<path d="M9 18h6"></path>
										<path d="M10 22h4"></path>
									</svg>
								</div>
							{/if}
							<div class="ml-4">
								<div class="text-sm font-medium text-gray-900 dark:text-white">
									{integration.name}
								</div>
								{#if integration.status === 'connected'}
									<div class="text-sm text-gray-500 dark:text-gray-400">
										Last Sync: {integration.lastSync}
									</div>
								{/if}
							</div>
						</div>
						<div>
							{#if integration.status === 'connected'}
								<span
									class="inline-flex items-center rounded-full bg-green-100 px-3 py-0.5 text-sm font-medium text-green-800 dark:bg-green-800 dark:text-green-100"
								>
									Connected
								</span>
							{:else if integration.status === 'disconnected'}
								<span
									class="inline-flex items-center rounded-full bg-gray-100 px-3 py-0.5 text-sm font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300"
								>
									Disconnected
								</span>
								<button
									class="ml-4 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
								>
									Connect
								</button>
							{:else if integration.status === 'error'}
								<span
									class="inline-flex items-center rounded-full bg-red-100 px-3 py-0.5 text-sm font-medium text-red-800 dark:bg-red-800 dark:text-red-100"
								>
									Error
								</span>
								<button
									class="ml-4 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
								>
									Reconnect
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
			<div
				class="border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800"
			>
				<button
					class="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
				>
					+ Add New Integration
				</button>
			</div>
		</div>
	</section>

	<!-- Notification Settings -->
	<section>
		<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Notifications</h2>

		<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
			<div class="bg-gray-50 px-6 py-4 dark:bg-gray-800">
				<h3 class="text-base font-medium text-gray-900 dark:text-white">Notification Settings</h3>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					Choose which notifications you want to receive
				</p>
			</div>
			<div
				class="divide-y divide-gray-200 border-t border-gray-200 dark:divide-gray-700 dark:border-gray-700"
			>
				{#each notificationSettings as setting}
					<div class="flex items-center justify-between bg-white px-6 py-4 dark:bg-gray-900">
						<div>
							<div class="text-sm font-medium text-gray-900 dark:text-white">{setting.name}</div>
							<div class="text-sm text-gray-500 dark:text-gray-400">{setting.description}</div>
						</div>
						<div>
							<label class="relative inline-flex cursor-pointer items-center">
								<input
									type="checkbox"
									class="peer sr-only"
									checked={setting.enabled}
									on:change={() => toggleNotification(setting.id)}
								/>
								<div
									class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
								></div>
							</label>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- General Settings -->
	<section>
		<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-white">General</h2>

		<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
			<div class="bg-gray-50 px-6 py-4 dark:bg-gray-800">
				<h3 class="text-base font-medium text-gray-900 dark:text-white">Theme</h3>
			</div>
			<div class="bg-white px-6 py-4 dark:bg-gray-900">
				<div class="flex items-center justify-between">
					<div>
						<div class="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</div>
						<div class="text-sm text-gray-500 dark:text-gray-400">
							Enable dark mode for the interface
						</div>
					</div>
					<div>
						<label class="relative inline-flex cursor-pointer items-center">
							<input type="checkbox" class="peer sr-only" />
							<div
								class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
							></div>
						</label>
					</div>
				</div>
			</div>
		</div>
	</section>
</div>
