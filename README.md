# Home Server

A Kubernetes-based home server with a Svelte landing page.

## Project Structure

- `.github/workflows/`: CI/CD workflows
  - `landing.yml`: Test, build, and deploy landing page
- `k8s/`: Kubernetes manifests
  - `landing-depl.yaml`: Frontend deployment and service
  - `ingress-svc.yaml`: Ingress configuration
  - `issuer.yaml`: SSL certificate configuration
- `landing/`: Svelte + Vite frontend

## Development

```bash
cd landing
npm install
npm run dev
```

## CI/CD

The landing page is automatically tested, built, and deployed when changes are pushed to the main branch. The workflow:

1. Tests the application
2. Builds and pushes a Docker image
3. Updates the Kubernetes deployment

Required GitHub Secrets:

- `RASPBERRY_PI_HOST`: Raspberry Pi IP address or hostname
- `RASPBERRY_PI_SSH_KEY`: SSH private key for connecting to Raspberry Pi
- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password

## License

MIT
