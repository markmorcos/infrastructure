<script lang="ts">
	type Scene = {
		id: number;
		name: string;
		icon: string;
		description: string;
		devices: number[];
		active: boolean;
	};

	let scenes: Scene[] = [
		{
			id: 1,
			name: 'Movie Night',
			icon: 'movie',
			description: 'Dim the lights and set the perfect atmosphere for watching movies',
			devices: [1, 2],
			active: false
		},
		{
			id: 2,
			name: 'Good Morning',
			icon: 'sunrise',
			description: 'Gradually turns on lights and adjusts thermostat in the morning',
			devices: [1, 3, 4],
			active: false
		},
		{
			id: 3,
			name: 'Good Night',
			icon: 'moon',
			description: 'Turns off all lights and adjusts thermostat for sleeping',
			devices: [1, 2, 3, 4],
			active: true
		},
		{
			id: 4,
			name: 'Away Mode',
			icon: 'away',
			description: "Security mode for when you're away from home",
			devices: [1, 2, 3, 4],
			active: false
		},
		{
			id: 5,
			name: 'Reading Time',
			icon: 'book',
			description: 'Comfortable lighting for reading',
			devices: [1, 3],
			active: false
		}
	];

	function activateScene(id: number): void {
		scenes = scenes.map((scene) => ({
			...scene,
			active: scene.id === id
		}));
	}

	let showAddSceneModal = false;

	function addScene(): void {
		showAddSceneModal = true;
	}

	function closeModal(): void {
		showAddSceneModal = false;
	}
</script>

<div class="space-y-6">
	<header
		class="flex items-center justify-between border-b border-gray-200 pb-5 dark:border-gray-700"
	>
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Scenes</h1>
			<p class="mt-1 text-gray-500 dark:text-gray-400">Create and manage your smart home scenes</p>
		</div>
		<button
			on:click={addScene}
			class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400"
		>
			Add Scene
		</button>
	</header>

	<!-- Scenes Grid -->
	<section>
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each scenes as scene}
				<div
					class="overflow-hidden rounded-lg border border-gray-200 shadow-sm dark:border-gray-700"
				>
					<div
						class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
					>
						<div class="flex items-center">
							{#if scene.icon === 'movie'}
								<div
									class="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-500 dark:bg-gray-700"
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
										<rect width="20" height="20" x="2" y="2" rx="2.18" ry="2.18"></rect>
										<line x1="7" x2="7" y1="2" y2="22"></line>
										<line x1="17" x2="17" y1="2" y2="22"></line>
										<line x1="2" x2="22" y1="12" y2="12"></line>
										<line x1="2" x2="7" y1="7" y2="7"></line>
										<line x1="2" x2="7" y1="17" y2="17"></line>
										<line x1="17" x2="22" y1="17" y2="17"></line>
										<line x1="17" x2="22" y1="7" y2="7"></line>
									</svg>
								</div>
							{:else if scene.icon === 'sunrise'}
								<div
									class="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-500 dark:bg-gray-700"
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
										<path d="M12 2v8"></path>
										<path d="m4.93 10.93 1.41 1.41"></path>
										<path d="M2 18h2"></path>
										<path d="M20 18h2"></path>
										<path d="m19.07 10.93-1.41 1.41"></path>
										<path d="M22 22H2"></path>
										<path d="m8 6 4-4 4 4"></path>
										<path d="M16 18a4 4 0 0 0-8 0"></path>
									</svg>
								</div>
							{:else if scene.icon === 'moon'}
								<div
									class="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-500 dark:bg-gray-700"
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
										<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
									</svg>
								</div>
							{:else if scene.icon === 'away'}
								<div
									class="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-gray-700"
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
											d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
										></path>
										<circle cx="12" cy="13" r="3"></circle>
									</svg>
								</div>
							{:else if scene.icon === 'book'}
								<div
									class="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-500 dark:bg-gray-700"
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
										<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
										<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
									</svg>
								</div>
							{/if}
							<h3 class="text-lg font-medium text-gray-900 dark:text-white">{scene.name}</h3>
						</div>

						<div class="flex items-center">
							<span
								class={`mr-2 inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${scene.active ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}
							>
								{scene.active ? 'Active' : 'Inactive'}
							</span>
							<button
								class="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<circle cx="12" cy="12" r="1"></circle>
									<circle cx="19" cy="12" r="1"></circle>
									<circle cx="5" cy="12" r="1"></circle>
								</svg>
							</button>
						</div>
					</div>

					<div class="bg-white p-4 dark:bg-gray-900">
						<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">{scene.description}</p>
						<div class="mb-4">
							<div class="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
								Devices
							</div>
							<div class="mt-1 text-sm text-gray-700 dark:text-gray-300">
								{scene.devices.length} devices
							</div>
						</div>
						<div class="flex justify-between">
							<button
								class="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
							>
								Edit
							</button>
							<button
								class={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium ${scene.active ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-800 dark:text-red-100 dark:hover:bg-red-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-800 dark:text-indigo-100 dark:hover:bg-indigo-700'}`}
								on:click={() => activateScene(scene.id)}
							>
								{scene.active ? 'Deactivate' : 'Activate'}
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Add Scene Modal -->
	{#if showAddSceneModal}
		<div
			class="fixed inset-0 z-10 overflow-y-auto"
			aria-labelledby="modal-title"
			role="dialog"
			aria-modal="true"
		>
			<div
				class="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0"
			>
				<!-- Background overlay -->
				<div
					class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
					aria-hidden="true"
					on:click={closeModal}
				></div>

				<!-- Modal panel -->
				<div
					class="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle dark:bg-gray-800"
				>
					<div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4 dark:bg-gray-800">
						<div class="sm:flex sm:items-start">
							<div class="mt-3 w-full text-center sm:ml-4 sm:mt-0 sm:text-left">
								<h3
									class="text-lg font-medium leading-6 text-gray-900 dark:text-white"
									id="modal-title"
								>
									Create New Scene
								</h3>
								<div class="mt-4 space-y-4">
									<div>
										<label
											for="scene-name"
											class="block text-sm font-medium text-gray-700 dark:text-gray-300"
										>
											Scene Name
										</label>
										<input
											type="text"
											id="scene-name"
											class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
											placeholder="Movie Night"
										/>
									</div>
									<div>
										<label
											for="scene-icon"
											class="block text-sm font-medium text-gray-700 dark:text-gray-300"
										>
											Icon
										</label>
										<select
											id="scene-icon"
											class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
										>
											<option value="movie">Movie</option>
											<option value="sunrise">Sunrise</option>
											<option value="moon">Moon</option>
											<option value="away">Away</option>
											<option value="book">Book</option>
										</select>
									</div>
									<div>
										<label
											for="scene-description"
											class="block text-sm font-medium text-gray-700 dark:text-gray-300"
										>
											Description
										</label>
										<textarea
											id="scene-description"
											rows={3}
											class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
											placeholder="Describe what this scene does"
										></textarea>
									</div>
									<div>
										<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
											Devices
										</label>
										<div class="mt-2 space-y-2">
											<div class="flex items-center">
												<input
													id="device-1"
													type="checkbox"
													class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
												/>
												<label
													for="device-1"
													class="ml-2 block text-sm text-gray-700 dark:text-gray-300"
												>
													Living Room Lights
												</label>
											</div>
											<div class="flex items-center">
												<input
													id="device-2"
													type="checkbox"
													class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
												/>
												<label
													for="device-2"
													class="ml-2 block text-sm text-gray-700 dark:text-gray-300"
												>
													Kitchen Lights
												</label>
											</div>
											<div class="flex items-center">
												<input
													id="device-3"
													type="checkbox"
													class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
												/>
												<label
													for="device-3"
													class="ml-2 block text-sm text-gray-700 dark:text-gray-300"
												>
													Bedroom Lights
												</label>
											</div>
											<div class="flex items-center">
												<input
													id="device-4"
													type="checkbox"
													class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
												/>
												<label
													for="device-4"
													class="ml-2 block text-sm text-gray-700 dark:text-gray-300"
												>
													Nest Thermostat
												</label>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 dark:bg-gray-700">
						<button
							type="button"
							class="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
						>
							Create Scene
						</button>
						<button
							type="button"
							class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:mt-0 sm:w-auto sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
							on:click={closeModal}
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
