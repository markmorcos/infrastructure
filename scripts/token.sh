#!/bin/bash

set -e

function print_usage() {
  echo "Usage:"
  echo "  ./token.sh encode <project_name>"
  echo "  ./token.sh decode <token>"
}

if [ $# -lt 2 ]; then
  print_usage
  exit 1
fi

ACTION=$1
PAYLOAD=$2

case $ACTION in
  "encode")
    JWT_SECRET=$(kubectl get secret jwt-secret -o jsonpath='{.data.JWT_SECRET}' -n infrastructure | base64 --decode)
    TOKEN=$(jwt encode --secret "$JWT_SECRET" --sub "$PAYLOAD")
    echo "Token: $TOKEN"
    ;;
  "decode")
    JWT_SECRET=$(kubectl get secret jwt-secret -o jsonpath='{.data.JWT_SECRET}' -n infrastructure | base64 --decode)
    jwt decode --secret "$JWT_SECRET" "$PAYLOAD" --ignore-exp
    ;;
  *)
    print_usage
    exit 1
    ;;
esac
