#!/bin/bash
set -e

# Deploy script for gh-mcp-server
# This builds the Docker image and pushes to Fly's registry

APP_NAME="${FLY_MCP_APP_NAME:-gh-mcp-server}"
IMAGE_TAG="${1:-latest}"
REGISTRY="registry.fly.io"
FULL_IMAGE="${REGISTRY}/${APP_NAME}:${IMAGE_TAG}"

echo "==> Authenticating with Fly registry..."
fly auth docker

echo "==> Building Docker image..."
docker build -t "${FULL_IMAGE}" .

echo "==> Pushing to Fly registry..."
docker push "${FULL_IMAGE}"

echo ""
echo "==> Done! Image pushed to: ${FULL_IMAGE}"
echo ""
echo "Set this in your environment:"
echo "  MCP_SERVER_IMAGE=${FULL_IMAGE}"
echo ""
echo "Or add to your .env file:"
echo "  echo 'MCP_SERVER_IMAGE=${FULL_IMAGE}' >> .env"
