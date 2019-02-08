#!/usr/bin/env bash
#start-setup.sh

apt-get update
apt-get install git

read -p "app location ? (/hewwod)" appdir
appdir=${appdir:-/hewwod}

git clone https://github.com/newtonick/hewwod-web.git $appdir

echo "Starting Upgrade Process ..."
sleep 3

apt-get upgrade -y
apt-get dist-upgrade -y

echo "Reboot in 10 seconds ..."
echo "After reboot, log in as root and run ${appdir}/scripts/continue-setup.sh"
sleep 10; shutdown -r now