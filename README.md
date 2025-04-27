# Home Server

A Kubernetes-based home server with a Svelte landing page.

## Project Structure

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

## License

MIT
