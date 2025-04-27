import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as net from 'net';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { ipAddress, port, command } = await request.json();

		if (!ipAddress || !port || !command) {
			return json({ error: 'Missing required parameters' }, { status: 400 });
		}

		// Use a TCP socket to communicate with the Yeelight device
		// as they use JSON-RPC protocol over TCP, not HTTP
		const responseData = await sendYeelightCommand(ipAddress, port, command);

		return json({ success: true, data: responseData });
	} catch (error) {
		console.error('Error proxying command to Yeelight device:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

// Function to send commands to Yeelight device using TCP socket
function sendYeelightCommand(
	ipAddress: string,
	port: number,
	command: Record<string, unknown>
): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection(port, ipAddress, () => {
			// Add newline terminators to the command
			const commandStr = JSON.stringify(command) + '\r\n';
			socket.write(commandStr);
		});

		let data = '';

		socket.on('data', (chunk: Buffer) => {
			data += chunk.toString();

			// Check if we have a complete JSON response (ends with newline)
			if (data.endsWith('\r\n')) {
				try {
					// Parse the JSON response
					const response = JSON.parse(data.trim());
					socket.end();
					resolve(response);
				} catch {
					socket.end();
					reject(new Error(`Invalid JSON in Yeelight response: ${data}`));
				}
			}
		});

		socket.on('error', (err: Error) => {
			socket.end();
			reject(err);
		});

		socket.on('timeout', () => {
			socket.end();
			reject(new Error('Connection to Yeelight device timed out'));
		});

		// Set a timeout for the socket connection
		socket.setTimeout(3000);
	});
}
