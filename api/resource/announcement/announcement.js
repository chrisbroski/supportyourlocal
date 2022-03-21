/*jshint esversion: 8 */

const main = require('../../inc/main.js');
var url = require('url');

const resourceName = 'announcement';
const template = {};

function songList(db, id) {
    const songs = [];
    Object.keys(db.song).forEach(sid => {
        var selected = "";
        if (id && db[resourceName][id] && db[resourceName][id].song === sid) {
            selected = ' selected="selected"';
        }
        if (db.song[sid].audio.spotify) {
            songs.push({
                "id": sid,
                "name": db.song[sid].name,
                "selected": selected,
                "date": db.song[sid].date
            });
        }
    });
    return songs.sort(main.sortByDate);
}

function single(db, id) {
    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": db[resourceName][id].date,
        "songs": songList(db, id),
        "pinnedChecked": !!db[resourceName][id].pinned ? ' checked="checked"' : ''
    }, db[resourceName][id]);

    return resourceData;
}

function list(db) {
    var resourceData = main.objToArray(db[resourceName]);
    resourceData.forEach(a => {
        a.shortCopy = a.copy.slice(0, 30);
        a.formattedDate = main.dateFormat(new Date(a.date + "T00:00:01"));
    });

    return {
        [resourceName]: resourceData,
        "today": main.dateFormat(new Date()),
        "resourceName": resourceName,
        "songs": songList(db, "")
    };
}

function singleData(db, id) {
    return Object.assign({
        "resourceName": resourceName,
        "spotifyTrackId": main.extractSpotifyTrackId(db.song[db[resourceName][id].song].audio.spotify)
    }, db[resourceName][id]);
}

function listData(db, req) {
    var qs = url.parse(req.url, true).query;

    var announcementData = {};
    announcementData.announcements = main.objToArray(db[resourceName]).sort(main.sortByDateDesc);
    announcementData.resourceName = resourceName;
    announcementData.announcements.forEach(a => {
        if (a.song && db.song[a.song] && db.song[a.song].audio && db.song[a.song].audio.spotify) {
            a.spotifyTrackId = main.extractSpotifyTrackId(db.song[a.song].audio.spotify);
        }
    });

    if (qs.pinned === "Y") {
        announcementData.announcements = announcementData.announcements.filter(a => {
            return !!a.pinned;
        });
    }

    return announcementData;
}

// Form validation
function isUpdateInvalid(req, rsp, formData, db) {
    var msg = [];

    if (!formData.copy) {
        msg.push('Copy text is required.');
    }

    return main.invalidMsg(rsp, msg, req, db);
}

function updateResource(id, formData, db, save) {
    db[resourceName][id].date = formData.date;
    db[resourceName][id].copy = formData.copy;
    db[resourceName][id].song = formData.song;
    db[resourceName][id].pinned = formData.pinned;

    save();
}

this.create = function (req, rsp, formData, db, save) {
    if (isUpdateInvalid(req, rsp, formData, db)) {
        return;
    }

    var id = main.createResource(formData, db, save, resourceName, updateResource);
    var returnData = main.responseData(id, resourceName, db, "Created");

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", returnData.link);
        return main.returnJson(rsp, returnData, true);
    }

    returnData.back = req.headers.referer;
    rsp.writeHead(201, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db));
};

this.update = function (req, rsp, id, formData, db, save) {
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'PUT', req, db);
    }
    if (isUpdateInvalid(req.headers.accept, rsp, formData, db)) {
        return;
    }

    // validate more fields
    updateResource(id, formData, db, save);
    var returnData = main.responseData(id, resourceName, db, "Updated");

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db));
};

this.remove = function (req, rsp, id, db, save) {
    var name;
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'DELETE', req, db);
    }

    name = db[resourceName][id].date;
    delete db[resourceName][id];
    save();

    var returnData = main.responseData(id, resourceName, db, "Deleted", [`${resourceName} '${name}' deleted.`]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db));
};

this.get = function (req, rsp, id, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (id) {
        if (!db[resourceName][id]) {
            return main.notFound(rsp, req.url, 'GET', req, db);
        }
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, singleData(db, id));
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id), db));
    } else {
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, listData(db, req));
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, list(db), db));
    }
};

async function loadData() {
    template.single = await main.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.list = await main.readFile(`${__dirname}/${resourceName}s.html.mustache`, 'utf8');
}

loadData();
