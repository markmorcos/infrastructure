# Home Server

A Kubernetes-based home server with a Svelte landing page.

## Project Structure

- `.github/workflows/`: CI/CD workflows
- `k8s/`: Kubernetes manifests
- `landing/`: Svelte + Vite frontend landing page
- `*.sh`: Shell scripts for setup, running, and cleanup

## Components

### Landing Page

A simple Svelte-based landing page for the home server.

## Development

### Landing Page

```bash
cd landing
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
