# YourLocal.band

Free site system for small bands with tools to take them from zero fans to 1,000!

## Installation

### Install Back End

The "back end" is a fully-featured web site and RESTful API. It can be run as the font facing web site, but as long as you are OK with a very simple visual style. There is no JavaScript on the HTML pages (and there never will be) so it can't do anything fancy, but this also gives it superior simplicity for speed, accessibility, security, and privacy.

#### Dependencies

You'll need [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) and [Node.js](https://nodejs.org/en/download/).

1. Clone the [YourLocalBand repo](https://github.com/chrisbroski/yourlocalband)
2. Change directory to `/api`
3. Run `npm install`
4. Run `npm start`

It should start running out of the box with default configuration. To customize your server, read about the environment values in the section below.

### Install Front End

Right now I maintain one standard front end called [Kandy](https://github.com/chrisbroski/kandy) that is very customtizable.

#### Dependencies

You'll need to run the [nginx](http://nginx.org/en/docs/install.html) web server. You may be able to run it with another web server, who knows? Good luck with that.

#### Clone the Front End

At the moment, it is only this one [https://github.com/chrisbroski/kandy](https://github.com/chrisbroski/kandy).

#### Add nginx Server Configuration

This is the basic one to start with:

    server {
        listen 60050;
        root /srv/kandy/www;

        location / {
            ssi on;
            ssi_last_modified on;
            index index.html;
            try_files $uri $uri/ $uri.shtml $uri.html $uri.txt =404;
            gzip on;
            client_max_body_size 20M;
        }

        # Location of where uploaded photos will be stored
        location ^~ /photo {
            root /srv/yourlocal;
            expires 1y;
            add_header Cache-Control "public";
            etag off;
            gzip off;
            add_header Last-Modified "";
            access_log off;
        }

        # Reverse proxy to pipe the back end to the `/api` subdirectory
        location ^~ /api {
            proxy_pass http://127.0.0.1:29170;
            proxy_http_version 1.1;
            proxy_set_header Host $host:$server_port;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Referrer $request;
            proxy_set_header Accept $http_accept;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header Connection "Upgrade";
            client_max_body_size 8M;
        }

        # Aggressively cache images and fonts
        location ~ \.(ico|gif|jpg|jpeg|png|svg|ttf|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public";
            etag off;
            gzip off;
            add_header Last-Modified "";
            access_log off;
        }
    }

## Environment Configuration

### PORT

The default port is 29170, but you can run it on anything you want. The major reasong to change this value is if you want to run multiple instances.

### MAP_KEY

This is the Google API key for location services.

### API_DIR

You can run the back end as any subdirectory of the main site but changeing this value and the reverse proxy locaiton inthe nginx config. Leave this blank if you are running the back end as a standalone, Javascript-free, site.

### FAIL_UNTIL_LOCKOUT

How many times a user can fil to log in before they are locked out for a determined time. If blank, the default is 10 times.

### LOCKOUT_DURATION_SECONDS = 600000

How long a user's login will be locked about after failure times, in miliseconds. Default is 10 minutes.

### SESSION_TIMEOUT_SECONDS

Maximum ength of time that session cookies will be kept. Default is 1 year.

### SETUP_TOKEN

If you are setting this site up for someone else, you can include a code here that will only initiate the setup process if it is inluded in a link.

### ADMIN_TOKEN

If this key is added, then certain admin processes will not work without it such as full data download.

### PHOTO_PATH

Location of the folder where downloaded photos will be stored.

### CSS_FRONT

If you include the path to your front end's css file, it will be serves with proper caching versions.

### PHOTO_STORAGE_LIMIT = 50000000

How much space is allowed for uploaded files. The default is 50000000 (50MB.)
