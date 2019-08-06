#!/bin/bash

cd $(dirname ..)
IMAGE=$(basename $PWD)

echo "Building tooling-test:latest"
(cd ../tooling-test-base; npm run docker:build;)

echo "Builidng $IMAGE:latest"
docker build -t "$IMAGE" -f ./docker/development.Dockerfile .
