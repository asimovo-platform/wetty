#!/bin/bash

ln -sf containers/wetty/Dockerfile .
podman build --platform linux/amd64 . -t registry.asimovo.com/component-images/wetty:development
