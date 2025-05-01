# Infrastructure

A Helm-based infrastructure as a service

## Project Structure

- `.github/workflows/`: CI/CD workflows
- `charts/`: Helm charts
  - `base-chart/`: Base Helm chart configuration
  - `templates/`: Common Kubernetes resource templates
- `k8s/`: Kubernetes manifests
- `*.sh`: Shell scripts for setup, running, and cleanup

## Development

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
