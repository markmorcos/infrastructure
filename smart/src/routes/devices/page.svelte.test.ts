import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import DevicesPage from './+page.svelte';

describe('DevicesPage', () => {
	beforeEach(() => {
		cleanup();
	});

	it('renders the devices page', () => {
		render(DevicesPage);

		expect(screen.getByText('Devices')).toBeInTheDocument();
		expect(screen.getByText('Manage your smart home devices')).toBeInTheDocument();
		expect(screen.getByText('Add Device')).toBeInTheDocument();
	});

	it('displays the devices table with correct headers', () => {
		render(DevicesPage);

		expect(screen.getByText('Device')).toBeInTheDocument();
		expect(screen.getByText('Location')).toBeInTheDocument();
		expect(screen.getByText('Type')).toBeInTheDocument();
		expect(screen.getByText('Status')).toBeInTheDocument();
		expect(screen.getByText('Last Updated')).toBeInTheDocument();
		expect(screen.getByText('Actions')).toBeInTheDocument();
	});

	it('displays the correct devices with their details', () => {
		render(DevicesPage);

		expect(screen.getByText('Living Room Lights')).toBeInTheDocument();
		expect(screen.getByText('Kitchen Lights')).toBeInTheDocument();
		expect(screen.getByText('Bedroom Lights')).toBeInTheDocument();
		expect(screen.getByText('Nest Learning Thermostat')).toBeInTheDocument();

		expect(screen.getByText('Living Room')).toBeInTheDocument();
		expect(screen.getByText('Kitchen')).toBeInTheDocument();
		expect(screen.getByText('Bedroom')).toBeInTheDocument();
	});

	it('opens the add device modal when add device button is clicked', async () => {
		render(DevicesPage);

		const addButton = screen.getByText('Add Device');
		await fireEvent.click(addButton);

		expect(screen.getByText('Add New Device')).toBeInTheDocument();
		expect(screen.getByText('Device Name')).toBeInTheDocument();
		expect(screen.getByText('Device Type')).toBeInTheDocument();
		expect(screen.getByText('Location')).toBeInTheDocument();
	});

	it('toggles device status when changed', async () => {
		render(DevicesPage);

		// Find the first device's toggle
		const toggles = document.querySelectorAll('input[type="checkbox"]');
		const livingRoomToggle = toggles[0] as HTMLInputElement;

		const initialState = livingRoomToggle.checked;
		await fireEvent.click(livingRoomToggle);

		// Status should be toggled
		expect(livingRoomToggle.checked).toBe(!initialState);
	});
});
