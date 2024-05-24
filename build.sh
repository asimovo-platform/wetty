#!/bin/bash


ln -sf containers/wetty/Dockerfile .
docker build . -t registry.asimovo.com/component-images/wetty $1

