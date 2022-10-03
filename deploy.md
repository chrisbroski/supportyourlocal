Deploy Process
==============

## QA

1. Turn off node.js API
2. Rename `api/data/data.json` to `{date}-data.json.backup`
3. Pull down data.json from production
4. Restart node.js API

Could I script this? Probably.

Then walk through basic stuff with an emphasis on hitting new features.

Add any data migrations in index.js load section.

## Launch

1. Back up `data.json` file.
2. Turn off node.js API service.
3. Pull from main.
4. Restart node.js API service.
