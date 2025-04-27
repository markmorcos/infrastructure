# Home Server

A Kubernetes-based home server with a Svelte landing page and a smart home dashboard.

## Project Structure

- `.github/workflows/`: CI/CD workflows
- `k8s/`: Kubernetes manifests
- `landing/`: Svelte + Vite frontend landing page
- `smart/`: SvelteKit-based smart home dashboard application
- `*.sh`: Shell scripts for setup, running, and cleanup

## Components

### Landing Page

A simple Svelte-based landing page for the home server.

### Smart Home Dashboard

A modern SvelteKit application for managing smart home devices, including Google Nest and smart bulbs.

Features:

- Dashboard for monitoring and controlling smart home devices
- Device and scene management
- Integration with Google Nest and smart bulb platforms
- Responsive UI with dark mode support

## Development

### Landing Page

```bash
cd landing
npm install
npm run dev
```

### Smart Home Dashboard

```bash
cd smart
npm install
npm run dev
```

### Using Docker Compose

```bash
docker compose up
```

## Setup and Deployment

### Initialize Kubernetes Setup

```bash
./init.sh
```

### Destroy Setup

```bash
./destroy.sh
```

## CI/CD

The applications are automatically tested, built, and deployed when changes are pushed to the main branch. The workflow:

1. Builds and pushes Docker images
2. Updates the Kubernetes deployments

Required GitHub Secrets:

- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password
- `RASPBERRY_PI_HOST`: Raspberry Pi IP address or hostname
- `RASPBERRY_PI_SSH_KEY`: SSH private key for connecting to Raspberry Pi

## License

MIT
