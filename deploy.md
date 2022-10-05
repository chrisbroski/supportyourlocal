Deploy Process
==============

## QA

1. Turn off node.js API
2. Rename `api/data/data.json` to `{date}-data.json.backup`
3. Pull down data.json from production
4. Restart node.js API

Could I script this? Probably. Should add an API backup key to download data direclty without having to SSH.

Then walk through basic stuff with an emphasis on hitting new features.

Add any data migrations in index.js load section.

## Launch

1. Back up production `data.json` file.
2. Turn off node.js API service.
3. Pull from main.
    `git fetch --all
    git checkout origin/main --force`
4. Restart node.js API service.
5. Pull front end too, possibly.

## New Site

1. Clone git@github.com:chrisbroski/yourlocalband.git
2. Copy `api/example.env` to `api/.env` and increment port number.
3. MAP_KEY = "AIzaSyDURh87Gbk15QtqLhHdK8iRsHsjkYRrEBs"
4. PHOTO_PATH = "/Users/christopherbroski/projects/yourlocal/photo"
5. DEV = "Y"
6. CSS_FRONT = "/Users/christopherbroski/projects/kandy/www/inc/main.css"
