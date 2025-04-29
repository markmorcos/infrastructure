set -e
export KUBECONFIG=$HOME/.kube/config
cd ~/Projects/home-server
git pull
kubectl rollout restart deployment landing-deployment