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

### Back End

1. Clone git@github.com:chrisbroski/yourlocalband.git
2. Copy `api/example.env` to `api/.env` and increment port number.
3. Set MAP_KEY
4. Set PHOTO_PATH
5. DEV = "Y"
6. Set CSS_FRONT

### Front End

1. Clone git@github.com:chrisbroski/kandy.git
2. Copy nginx configuration file with updated values: API port, domain/port, root path, and photo path.

