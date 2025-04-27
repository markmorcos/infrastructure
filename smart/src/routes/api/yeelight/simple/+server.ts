import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const ipAddress = url.searchParams.get('ip');
		const action = url.searchParams.get('action');

		if (!ipAddress || !action) {
			return json({ error: 'Missing required parameters' }, { status: 400 });
		}

		let endpoint = '';

		// Map actions to endpoints
		switch (action) {
			case 'toggle':
				endpoint = '/toggle';
				break;
			case 'on':
				endpoint = '/on';
				break;
			case 'off':
				endpoint = '/off';
				break;
			default:
				return json({ error: 'Unsupported action' }, { status: 400 });
		}

		// Forward the request to the Yeelight device
		const response = await fetch(`http://${ipAddress}${endpoint}`, {
			method: 'GET',
			signal: AbortSignal.timeout(3000)
		});

		if (response.ok) {
			return json({ success: true });
		} else {
			// Try alternative API
			try {
				const altResponse = await fetch(`http://${ipAddress}/api/${action}`, {
					method: 'GET',
					signal: AbortSignal.timeout(3000)
				});

				if (altResponse.ok) {
					return json({ success: true });
				} else {
					return json(
						{
							success: false,
							error: `Yeelight device returned status ${response.status} and alternative API failed with ${altResponse.status}`
						},
						{ status: response.status }
					);
				}
			} catch {
				return json(
					{
						success: false,
						error: `Yeelight device returned status ${response.status} and alternative API failed`
					},
					{ status: response.status }
				);
			}
		}
	} catch (_error) {
		console.error('Error sending simple command to Yeelight device:', _error);
		return json(
			{
				success: false,
				error: _error instanceof Error ? _error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
