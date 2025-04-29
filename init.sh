#!/bin/bash

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "kubectl is not installed. Please install it first."
    exit 1
fi

# Check if helm is installed
if ! command -v helm &> /dev/null; then
    echo "helm is not installed. Please install it first."
    exit 1
fi

echo "Initializing home server setup..."

# Install ingress-nginx if not already installed
if ! helm list -n ingress-nginx | grep -q ingress-nginx; then
    echo "Installing ingress-nginx..."
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace
fi

# Install cert-manager if not already installed
if ! helm list -n cert-manager | grep -q cert-manager; then
    echo "Installing cert-manager..."
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    helm upgrade --install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set crds.enabled=true
fi

# Wait for ingress-nginx and cert-manager to be ready
echo "Waiting for ingress-nginx and cert-manager to be ready..."
kubectl wait --for=condition=available deployment/ingress-nginx-controller -n ingress-nginx --timeout=300s
kubectl wait --for=condition=available deployment/cert-manager -n cert-manager --timeout=300s

# Apply Kubernetes manifests
echo "Applying Kubernetes manifests..."
kubectl apply -f k8s/

echo "Home server initialization complete!"