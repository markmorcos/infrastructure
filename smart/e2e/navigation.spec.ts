import { test, expect } from '@playwright/test';

test.describe('Navigation Tests', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('navigates between pages correctly', async ({ page }) => {
		// Verify we're on the dashboard
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

		// Navigate to Devices page
		await page.click('text=Devices');
		await expect(page.url()).toContain('/devices');
		await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible();

		// Navigate to Scenes page
		await page.click('text=Scenes');
		await expect(page.url()).toContain('/scenes');
		await expect(page.getByRole('heading', { name: 'Scenes' })).toBeVisible();

		// Navigate to Settings page
		await page.click('text=Settings');
		await expect(page.url()).toContain('/settings');
		await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

		// Go back to Dashboard
		await page.click('text=Dashboard');
		await expect(page.url()).toEqual(new URL('/', page.url()).toString());
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	});

	test('device controls work on dashboard', async ({ page }) => {
		// Find the device toggle for Living Room Lights
		const deviceCardLocator = page.locator('text=Living Room Lights').first();
		const deviceCard = await deviceCardLocator.locator(
			'xpath=ancestor::div[contains(@class, "rounded-md")]'
		);
		const toggle = await deviceCard.locator('input[type="checkbox"]');

		// Get initial state
		const initialState = await toggle.isChecked();

		// Toggle the device
		await toggle.click();

		// Verify the toggle state has changed
		if (initialState) {
			await expect(toggle).not.toBeChecked();
		} else {
			await expect(toggle).toBeChecked();
		}

		// If it was turned on, check that brightness slider appears
		if (!initialState) {
			await expect(deviceCard.locator('input[type="range"]')).toBeVisible();
		}
	});

	test('scenes can be activated', async ({ page }) => {
		// Navigate to Scenes page
		await page.click('text=Scenes');

		// Find an inactive scene
		const inactiveSceneLocator = page.locator('text=Inactive').first();
		const sceneCard = await inactiveSceneLocator.locator(
			'xpath=ancestor::div[contains(@class, "overflow-hidden")]'
		);

		// Click activate button
		await sceneCard.locator('text=Activate').click();

		// Check if it's now active
		await expect(sceneCard.locator('text=Active')).toBeVisible();

		// Verify only one scene is active by counting active badges
		const activeScenes = await page.locator('text=Active').count();
		expect(activeScenes).toBe(1);
	});

	test('add device modal works', async ({ page }) => {
		// Navigate to Devices page
		await page.click('text=Devices');

		// Click Add Device button
		await page.click('text=Add Device');

		// Verify modal appears
		await expect(page.locator('text=Add New Device')).toBeVisible();

		// Fill form
		await page.fill('input#device-name', 'Test Device');
		await page.selectOption('select#device-type', 'bulb');
		await page.selectOption('select#device-location', 'Living Room');
		await page.fill('input#device-manufacturer', 'Test Brand');
		await page.fill('input#device-model', 'Test Model');

		// Close modal by clicking Cancel
		await page.click('text=Cancel');

		// Verify modal is gone
		await expect(page.locator('text=Add New Device')).not.toBeVisible();
	});
});
