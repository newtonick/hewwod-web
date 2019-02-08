# hewwod-web

This setup is focused around running docker apps for node, mongo, nginx, and certbot on an Ubuntu 18.04 LTS server. I also include some basic steps for a local dev setup.

Run this command to start the install process on ubuntu server. Skip the server setup scripts section if your running on a local development envirorment.

### Server Setup Scripts

```curl -sL https://github.com/newtonick/hewwod-web/raw/master/scripts/run.sh| bash -s "hewwod.com"```

Replace "hewwod.com" argument with the hostname for the ubuntu server. Don't include any arguments if you don't want to change the hostname.

Once the curl command is complete, follow the instructions on the screen. The setup.sh script will need to be executed as root. This setup script will do a few things.

1. Define an app location on the server. The default is /hewwod
2. Clone this repo to the server in the app location
3. Upgrade Ubuntu to the latests packages and distro. This script was created for Ubuntu LTS 18.04

```./setup.sh```

Once this script is complete, it will give 10 seconds and then restart the server. Reconnect to the server after reboot.

Make your current working directory the app directory you picked during the setup.sh script run.

```cd /hewwod```

Now run the continue-setup.sh script in the scripts dir

```./scripts/continue-setup.sh```

This continue-setup.sh script will

1. Install/update the packages docker docker-compose ufw git npm
2. Create a hew user and group hewwod
3. Optionally allow addition of a second admin user
4. Setup and turn on a firewall (UFW) for posts 80, 443, and 22
5. Prompt for domain name
6. Setup a SSL Cert using Let's Encrypt using a temp nginx docker image. There are a bunch a questions for this one.
7. Moves around and cleans up the cert keys and build once it's complete
8. npm install in the app directory
9. Change the permission of the entire app dir to hewwod:hewwod

Once this is complete you'll want to change to the hewwod user and run the docker commands

```su - hewwod```

Change to the app dir

```cd /hewwod```

Start the mongodb server/docker

```docker-compose up -d hewwod-mongo```

Check to see if it's running...

```docker ps```

Now start nginx and api

```docker-compose up -d hewwod-nginx```

Go to the endpoint api/1.0/workouts and it should work...

```{"status":"success","workouts":[],"cached":false}```

Things left to do:

- cron job for certbot (ssl renewal)
- restore backup from existing database to mongodb

### Local Setup

```git clone https://github.com/newtonick/hewwod-web.git```

```cd hewwob-web```

```npm install```

```docker-compose up hewwod-api```

Then go to port 3001 on the localhost

### Mongo Database backup and restore

...
