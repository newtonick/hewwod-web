#!/usr/bin/env bash
#curl -sL https://github.com/newtonick/hewwod-web/raw/master/scripts/run.sh| bash -s "hewwod.com"

curl -LJO https://github.com/newtonick/hewwod-web/raw/master/scripts/setup.sh
chmod u+x setup.sh

if [[ $1 != "" ]]
then
	hostnamectl set-hostname $1
fi

echo "Hostname is $(hostname)"
echo "Now run setup.sh to start setup"