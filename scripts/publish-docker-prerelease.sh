#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

DOCKER_USERNAME="zimengxiong"
IMAGE_NAME="excalidash"
VERSION=${1:-$(node -e "try { console.log(require('fs').readFileSync('VERSION', 'utf8').trim() + '-dev') } catch { console.log('pre-release') }")}

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "prerelease" ] && [ "$CURRENT_BRANCH" != "pre-release" ]; then
  echo "ERROR: This script can only be run on the 'prerelease' or 'pre-release' branch!"
  echo "Current branch: '$CURRENT_BRANCH'"
  echo "Please switch to the prerelease branch and try again."
  exit 1
fi

echo "ExcaliDash Pre-Release Docker Builder"
echo "Tag: $VERSION"

echo "Checking Docker Hub authentication..."
if ! docker info | grep -q "Username: $DOCKER_USERNAME"; then
  echo "Not logged in. Please login to Docker Hub:"
  docker login
else
  echo "Already logged in as $DOCKER_USERNAME."
fi

echo "Setting up buildx builder..."
if ! docker buildx inspect excalidash-builder > /dev/null 2>&1; then
  echo "Creating new buildx builder..."
  docker buildx create --name excalidash-builder --use --bootstrap
else
  echo "Using existing buildx builder."
  docker buildx use excalidash-builder
fi

echo "Building and pushing backend pre-release image..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "$DOCKER_USERNAME/$IMAGE_NAME-backend:$VERSION" \
  --tag "$DOCKER_USERNAME/$IMAGE_NAME-backend:dev" \
  --file backend/Dockerfile \
  --push \
  backend/

echo "Backend pre-release image pushed successfully."

echo "Building and pushing frontend pre-release image..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "$DOCKER_USERNAME/$IMAGE_NAME-frontend:$VERSION" \
  --tag "$DOCKER_USERNAME/$IMAGE_NAME-frontend:dev" \
  --build-arg VITE_APP_VERSION="$VERSION" \
  --build-arg VITE_APP_BUILD_LABEL="pre-release" \
  --file frontend/Dockerfile \
  --push \
  .

echo "Frontend pre-release image pushed successfully."
echo "Pre-release images published."
