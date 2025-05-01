#!/bin/bash

echo "Destroying infrastructure setup..."

# Delete Kubernetes manifests
echo "Deleting Kubernetes manifests..."
kubectl delete -f k8s/ --wait

# Uninstall cert-manager
echo "Uninstalling cert-manager..."
helm uninstall cert-manager -n cert-manager

# Uninstall ingress-nginx
echo "Uninstalling ingress-nginx..."
helm uninstall ingress-nginx -n ingress-nginx

# Delete namespaces
echo "Deleting namespaces..."
kubectl delete namespace cert-manager ingress-nginx

echo "Infrastructure cleanup complete!"