#!/bin/bash

export NODE_ENV=production

touch /tmp/node.output

docker network create -d bridge --attachable --internal --ip-range=192.168.5.0/24 --subnet=192.168.5.0/24 test
docker network create -d bridge --attachable --internal --ip-range=192.168.6.0/24 --subnet=192.168.6.0/24 debug
docker run --rm --name wettyTest -e DEBUG=* -p3000:3000 -p9229:9229 -v ${PWD}/logs:/logs -v /home/ludo/.ssh:/home/node/.ssh --net test registry.asimovo.com/component-images/wetty:latest nodemon --trace-sigint --prof --logfile=/logs/profile.log --track-heap-objects --inspect=0.0.0.0:9229 . --allow-iframe --log-level 7 --port 3000 --force-ssh --ssh-host 192.168.5.1 --ssh-auth publickey --ssh-key id_rsa.pub &> run.log &
sleep 1
docker network connect debug wettyTest


export INTERRUPTED="false"
int_trap() {
    echo "Ctrl-C pressed"
    export INTERRUPTED="true"
}
trap int_trap INT

while [ $INTERRUPTED == "false" ];
do
  sleep 10
done

docker container stop wettyTest
docker network rm test
docker network rm debug
