const fs = require("fs").promises;
const main = require('../../inc/main.js');
var url = require('url');

const resourceName = 'announcement';
const template = {};

function songList(db, id) {
    const songs = [];
    Object.keys(db.song).forEach(sid => {
        var selected = "";
        if (id && id === sid) {
            selected = ' selected="selected"';
        }
        songs.push({
            "id": sid,
            "name": db.song[sid].name,
            "selected": selected,
            "date": db.song[sid].date
        });
    });
    return songs.sort(main.sortByDate);
}

function single(db, id, msg, error) {
    var announcements = main.objToArray(db[resourceName]).sort(main.sortByDateDesc);
    announcements.forEach(a => {
        a.shortCopy = a.copy.slice(0, 30);
    });

    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": db[resourceName][id].date,
        "songs": songList(db, db[resourceName][id].song),
        "pinnedChecked": !!db[resourceName][id].pinned ? ' checked="checked"' : '',
        "announcements": announcements
    }, db[resourceName][id]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function list(db, msg, error, link) {
    var resourceData = main.objToArray(db[resourceName]).sort(main.sortByDateDesc);
    resourceData.forEach(a => {
        a.shortCopy = a.copy.slice(0, 30);
    });

    var returnData = {
        [resourceName]: resourceData,
        "resourceName": resourceName,
        "songs": songList(db, ""),
        "pageName": `${main.toTitleCase(resourceName)}s`,
        "formData": {
            "date": main.dateFormat(new Date())
        }
    };
    return Object.assign(main.addMessages(msg, error, link), returnData);
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
function isUpdateInvalid(formData) {
    var msg = [];

    if (!formData.copy && !formData.song) {
        msg.push('Either copy text or a song is required.');
    }

    return msg;
}

function updateResource(id, formData, db, save) {
    db[resourceName][id].date = formData.date;
    db[resourceName][id].copy = formData.copy;
    db[resourceName][id].song = formData.song;
    db[resourceName][id].pinned = formData.pinned;

    save();
}

this.create = function (req, rsp, formData, db, save) {
    var error = isUpdateInvalid(formData);
    var returnData;
    if (error.length) {
        returnData = list(db);
        returnData.hasError = true;
        returnData.error = error;
        returnData.formData = formData;
        returnData.songs = songList(db, formData.song);
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, returnData, db));
        return;
    }

    var id = main.createResource(formData, db, save, resourceName, updateResource);
    returnData = main.responseData(id, resourceName, db, "Created");

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", `${process.env.SUBDIR}/${resourceName}/${id}`);
        return main.returnJson(rsp, returnData, 201);
    }

    rsp.writeHead(201, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.list, Object.assign({
        "hasMsg": true,
        "link": {"text": `Created ${resourceName} id ${id}`, "href": `${process.env.SUBDIR}/${resourceName}/${id}`}
    }, list(db)), db));
};

this.update = function (req, rsp, id, formData, db, save) {
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'PUT', req, db);
    }
    var error = isUpdateInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id, "", error), db));
        return;
    }

    // validate more fields
    updateResource(id, formData, db, save);
    var returnData = main.responseData(id, resourceName, db, "Updated");

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    // returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, id, [`${resourceName} id ${id} updated.`]), db));
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
    template.single = await fs.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.list = await fs.readFile(`${__dirname}/${resourceName}s.html.mustache`, 'utf8');
}

loadData();
