<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<!-- Sidebar -->
	<aside
		class="fixed inset-y-0 left-0 z-50 hidden w-64 bg-white shadow-lg lg:block dark:bg-gray-800"
	>
		<div
			class="flex h-16 items-center justify-center border-b border-gray-200 dark:border-gray-700"
		>
			<h1 class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">SmartHome</h1>
		</div>
		<nav class="mt-5 px-2">
			<a
				href="/"
				class={`mb-1 flex items-center rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 ${$page.url.pathname === '/' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="mr-3 h-5 w-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
					<polyline points="9 22 9 12 15 12 15 22"></polyline>
				</svg>
				Dashboard
			</a>
			<a
				href="/devices"
				class={`mb-1 flex items-center rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 ${$page.url.pathname === '/devices' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="mr-3 h-5 w-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<rect width="20" height="14" x="2" y="3" rx="2"></rect>
					<line x1="8" x2="16" y1="21" y2="21"></line>
					<line x1="12" x2="12" y1="17" y2="21"></line>
				</svg>
				Devices
			</a>
			<a
				href="/scenes"
				class={`mb-1 flex items-center rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 ${$page.url.pathname === '/scenes' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="mr-3 h-5 w-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
					<path d="M2 12h20"></path>
				</svg>
				Scenes
			</a>
			<a
				href="/settings"
				class={`mb-1 flex items-center rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 ${$page.url.pathname === '/settings' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="mr-3 h-5 w-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
					></path>
					<circle cx="12" cy="12" r="3"></circle>
				</svg>
				Settings
			</a>
		</nav>
	</aside>

	<!-- Mobile header -->
	<div
		class="flex h-16 items-center justify-between bg-white px-4 shadow-sm lg:hidden dark:bg-gray-800"
	>
		<h1 class="text-xl font-bold text-indigo-600 dark:text-indigo-400">SmartHome</h1>
		<button type="button" class="text-gray-600 dark:text-gray-300">
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
				<line x1="4" x2="20" y1="12" y2="12"></line>
				<line x1="4" x2="20" y1="6" y2="6"></line>
				<line x1="4" x2="20" y1="18" y2="18"></line>
			</svg>
		</button>
	</div>

	<!-- Main content -->
	<main class="min-h-screen lg:pl-64">
		<div class="px-4 py-6 sm:px-6 lg:px-8">
			<slot />
		</div>
	</main>
</div>
