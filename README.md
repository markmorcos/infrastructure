# Home Server

A Kubernetes-based home server with a Svelte landing page.

## Project Structure

- `.github/workflows/`: CI/CD workflows
- `k8s/`: Kubernetes manifests
- `landing/`: Svelte + Vite frontend

## Development

```bash
cd landing
npm install
npm run dev
```

## CI/CD

The landing page is automatically tested, built, and deployed when changes are pushed to the main branch. The workflow:

1. Builds and pushes a Docker image
2. Updates the Kubernetes deployment

Required GitHub Secrets:

- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password
- `RASPBERRY_PI_HOST`: Raspberry Pi IP address or hostname
- `RASPBERRY_PI_SSH_KEY`: SSH private key for connecting to Raspberry Pi

## License

MIT
