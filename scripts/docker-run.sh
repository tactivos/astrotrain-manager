#!/bin/bash

cd $(dirname ..)
IMAGE=$(basename $PWD)

if [[ $1 == *".feature"* ]] || [[ $1 == '' ]]; then
  ARGS="./scripts/test.sh ../train/test.ts ../train/$*"
else
  ARGS="$*"
fi

docker rm -f "$IMAGE" 1>/dev/null

docker run --name="$IMAGE"                                                     \
  -v "$(realpath $PWD/../tooling-test-base):/usr/src"                          \
  -v "$PWD:/usr/train"                                                         \
  -ti "$IMAGE:latest"                                                          \
  $ARGS
