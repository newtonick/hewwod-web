#!/usr/bin/env bash
#continue-setup.sh

SETUPDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

APPDIR="$SETUPDIR/.."

apt-get install docker docker-compose ufw git npm -y

apt-get clean -y
apt-get autoremove -y

echo "Creating user and group hewwod"; sleep 3

adduser hewwod
usermod -aG docker hewwod

read -p "Do you want to add an admin/sudo user? (Y/n):" userquestion

if [[ $userquestion = "y" || $userquestion = "Y" ]]
then
	read -p "What username?" newusername
	if [[ $newusername != "" ]]
	then
		adduser $newusername
		usermod -aG docker $newusername
		usermod -aG sudo $newusername
		usermod -aG hewwod $newusername
	fi
fi

echo "Setting up firewall (ufw) ..."; sleep 3

ufw allow ssh
ufw allow http
ufw allow https
ufw enable

# sed -c -i "s/PermitRootLogin yes/#PermitRootLogin yes/" /etc/ssh/sshd_config

read -p "What is the domain name?" domainname
domainname=${domainname:-hewwod.com}

echo "adding domain name $domainname to nginx letsencrypt.conf"
sed -i "s/@@DOMAIN@@/$domainname/g" "$APPDIR/etc/nginx/sites/letsencrypt.conf"

cd "$APPDIR"

docker-compose up -d letsencrypt-nginx-container

echo "Check website $domainname"
read -p "is it running? (Y/n)" isitrunning
if [[ $isitrunning = "y" || $isitrunning = "Y" ]]
then
	echo "good ..."
else
	echo "script fail, will need to troubleshoot"
	exit 1
fi

read -p "Email Address for Let's Encrypt:" emailaddress

if [[ $emailaddress != "" ]]
then
	letsemailcommand="--email ${emailaddress}"
else
	letsemailcommand="--register-unsafely-without-email"
fi

echo "Now Running Dry Run of Certbot"

docker run -it --rm \
-v "$APPDIR/etc/letsencrypt:/etc/letsencrypt" \
-v "$APPDIR/var/lib/letsencrypt:/var/lib/letsencrypt" \
-v "$APPDIR/static/letsencrypt:/data/letsencrypt" \
-v "$APPDIR/var/log/letsencrypt:/var/log/letsencrypt" \
certbot/certbot \
certonly --webroot \
${letsemailcommand} --agree-tos \
--webroot-path=/data/letsencrypt \
--staging \
-d ${domainname} -d www.${domainname}

read -p "Did dry run complete successfully? (Y/n)" diddryrunwork

if [[ $diddryrunwork = "y" || $diddryrunwork = "Y" ]]
then
	echo "good ... doing actual run now"
else
	echo "script fail, will need to troubleshoot"
	exit 1
fi

docker run -it --rm \
-v "$APPDIR/etc/letsencrypt:/etc/letsencrypt" \
-v "$APPDIR/var/lib/letsencrypt:/var/lib/letsencrypt" \
-v "$APPDIR/static/letsencrypt:/data/letsencrypt" \
-v "$APPDIR/var/log/letsencrypt:/var/log/letsencrypt" \
certbot/certbot \
certonly --webroot \
${letsemailcommand} --agree-tos \
--webroot-path=/data/letsencrypt \
-d ${domainname} -d www.${domainname}

read -p "Did everything run successfully? (Y/n)" didrunwork

if [[ $didrunwork = "y" || $didrunwork = "Y" ]]
then
	echo "good ... now cleaning up"
else
	echo "script fail, will need to troubleshoot"
	exit 1
fi

docker-compose down

echo "symbolic links to letsencrypt keys ..."; sleep 3

mkdir "$APPDIR/keys"
mkdir "$APPDIR/keys/letsencrypt"
mkdir "$APPDIR/keys/letsencrypt/${domainname}"
ln -s "$APPDIR/etc/letsencrypt/live/${domainname}/fullchain.pem" "./keys/letsencrypt/${domainname}/fullchain.pem"
ln -s "$APPDIR/etc/letsencrypt/live/${domainname}/privkey.pem" "./keys/letsencrypt/${domainname}/privkey.pem"

if [[ $domainname != "hewwod.com" ]]
then
  cp "$APPDIR/etc/nginx/sites/hewwod.com.conf" "$APPDIR/etc/nginx/sites/${domainname}.conf"
fi

echo "adding domain name $domainname to nginx nginx.conf"; sleep 3
sed -i "s/@@DOMAIN@@/$domainname/g" "$APPDIR/etc/nginx/sites/${domainname}.conf"

echo "updating docker-compose.yml to use $APPDIR/etc/nginx/sites/${domainname}.conf in nginx conf"; sleep 3
sed -i "s/sites\/local.conf/sites\/${domainname}.conf/g" "$APPDIR/docker-compose.yml"

mkdir "$APPDIR/keys/dh-param"
openssl dhparam -out "$APPDIR/keys/dh-param/dhparam-2048.pem" 2048

npm install

# change permission on all files to hewwod user and group
echo "Setting up app directory ($APPDIR) to be owned by hewwod ..."; sleep 5
chown -R hewwod:hewwod "$APPDIR"

echo "switch to hewwod user before running docker-compose up -d hewwod-api"

