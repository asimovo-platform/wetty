#!/bin/bash



if [ "xx" == "x$1x" ]; then
        export VERSION="development"
else
        export VERSION=$1
fi

echo "Deploying version: $VERSION to registry."

docker tag registry.asimovo.com/component-images/wetty:latest registry.asimovo.com/component-images/wetty:$VERSION
docker push registry.asimovo.com/component-images/wetty:$VERSION

