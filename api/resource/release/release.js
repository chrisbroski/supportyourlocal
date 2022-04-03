const main = require('../../inc/main.js');

const resourceName = 'release';
const template = {};

function songList(songs) {
    return songs.map(s => {
        return {
            "song-id": s.id,
            "song-name": s.name
        };
    });
}

function albumList(songs, db) {
    return songs.map(s => {
        return {
            "song-id": s,
            "song-name": db.song[s].name
        };
    });
}

function pageName(db, id) {
    if (db.release[id].name) {
        return db.release[id].name;
    }
    if (db.release[id].songs.length === 1) {
        return db.song[db.release[id].songs[0]].name;
    }
    return db.release[id].desc.substring(0, 32);
}

function single(db, id, msg, error) {
    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": pageName(db, id),
        "songlist": songList(main.objToArray(db.song)),
        "albumList": albumList(db[resourceName][id].songs, db)
    }, db[resourceName][id]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function list(db, msg, error, link) {
    var releases = main.objToArray(db[resourceName]).sort(main.sortByDateDesc);
    releases = releases.map(r => {
        r.pageName = pageName(db, r.id);
        return r;
    });
    var resourceData = {
        [resourceName]: releases,
        // "today": main.dateFormat(new Date()),
        "resourceName": resourceName,
        "songlist": songList(main.objToArray(db.song)),
        "pageName": `${main.toTitleCase(resourceName)}s`
    };

    return Object.assign(main.addMessages(msg, error, link), resourceData);
}

function singleData(db, id) {
    return Object.assign({"resourceName": resourceName}, db[resourceName][id]);
}

function listData(db) {
    return main.objToArray(db[resourceName]).sort(main.sortByDateDesc);
}

// Form validation
function isUpdateInvalid(formData, db, id) {
    var msg = [];
    var hasSong = !!formData["initial-song"];
    if (id && db.release[id].songs.length > 0) {
        hasSong = true;
    }

    if (!formData.date) {
        msg.push('Date is required.');
    }

    if (!formData.name && !formData.desc && !hasSong) {
        msg.push('You must give your release a name, description, or one song.');
    }

    return msg;
}

function isSongInvalid(formData) {
    var msg = [];

    if (!formData["song-id"]) {
        msg.push('Song is required.');
    }
    // Make sure it is not a duplicate song
    // maybe check that the song id is valid too

    return msg;
}

function isReorderInvalid(formData, db, id) {
    var msg = [];

    if (!formData["song-id"]) {
        msg.push('Song is required.');
    }
    if (!formData.index) {
        msg.push('New index is required.');
    }
    if (db.release[id].songs.indexOf(formData["song-id"]) < 0) {
        msg.push('Song not found in release.');
    }
    return msg;
}

function updateResource(id, formData, db, save) {
    db[resourceName][id].name = formData.name;
    db[resourceName][id].date = formData.date;
    db[resourceName][id].desc = formData.desc;
    db[resourceName][id].credits = formData.credits;

    db[resourceName][id]["cover-front"] = formData["cover-front"];
    db[resourceName][id]["cover-back"] = formData["cover-back"];

    if (!db[resourceName][id].audio) {
        db[resourceName][id].audio = {};
    }
    db[resourceName][id].audio.spotify = formData.spotify;
    db[resourceName][id].audio.apple = formData.apple;
    db[resourceName][id].audio.amazon = formData.amazon;
    db[resourceName][id].audio.youtube = formData.youtube;
    db[resourceName][id].audio.cdbaby = formData.cdbaby;

    if (!db[resourceName][id].songs) {
        db[resourceName][id].songs = [];
    }
    if (formData["initial-song"]) {
        db[resourceName][id].songs.push(formData["initial-song"]);
    }

    save();
}

function patchResource(id, formData, db, save) {
    var currentIndex = db.release[id].songs.indexOf(formData["song-id"]);
    var newIndex = formData.index;
    if (newIndex >= db.release[id].songs.length) {
        newIndex = db.release[id].songs.length - 1;
    }
    db.release[id].songs.splice(currentIndex, 1);
    if (parseInt(formData.index) > -1) {
        db.release[id].songs.splice(newIndex, 0, formData["song-id"]);
    }

    save();
}

this.addSong = function (req, rsp, id, formData, db, save, API_DIR) {
    // if (isSongInvalid(req, rsp, id, formData, db)) {
    //     return;
    // }

    // var id = main.createResource(formData, db, save, resourceName, updateResource);
    // var returnData = main.responseData(id, resourceName, db, "Song Added", API_DIR, ["Song added"]);
    var error = isSongInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, Object.assign({
            "hasError": true,
            "error": error,
            "formData": formData
        }, list(db)), db, API_DIR));
        // ^ this needs selected values too
        return;
    }
    // var id = main.createResource(formData, db, save, resourceName, updateResource);
    // var returnData = main.responseData(id, resourceName, db, "Song Added", API_DIR, ["Song added"]);
    if (formData["song-id"]) {
        db[resourceName][id].songs.push(formData["song-id"]);
    }
    save();

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", `${API_DIR}/${resourceName}/${id}`);
        return main.returnJson(rsp, {}, 201);
    }

    // returnData.back = req.headers.referer;
    rsp.writeHead(201, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, id, ["Song added"]), db, API_DIR));
};

this.reorderSong = function(req, rsp, id, formData, db, save, API_DIR) {
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'PATCH', req, db);
    }

    var error = isReorderInvalid(formData, db, id);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id, "", error), db, API_DIR));
        return;
    }

    patchResource(id, formData, db, save);
    var returnData = main.responseData(id, resourceName, db, "Updated", API_DIR);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, id, [`${resourceName} id ${id} songs updated.`]), db, API_DIR));
};

this.create = function (req, rsp, formData, db, save, API_DIR) {
    var error = isUpdateInvalid(formData, db, id);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, Object.assign({
            "hasError": true,
            "error": error,
            "formData": formData
        }, list(db)), db, API_DIR));
        // ^ this needs selected values too
        return;
    }

    var id = main.createResource(formData, db, save, resourceName, updateResource);
    var returnData = main.responseData(id, resourceName, db, "Created", API_DIR);

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", `${API_DIR}/${resourceName}/${id}`);
        return main.returnJson(rsp, returnData, 201);
    }

    rsp.writeHead(201, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.list, Object.assign({
        "hasMsg": true,
        "link": {"text": `Created ${resourceName} id ${id}`, "href": `${API_DIR}/${resourceName}/${id}`}
    }, list(db)), db, API_DIR));
};

this.update = function (req, rsp, id, formData, db, save, API_DIR) {
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'PUT', req, db);
    }
    var error = isUpdateInvalid(formData, db, id);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id, "", error), db, API_DIR));
        return;
    }

    // validate more fields
    updateResource(id, formData, db, save);
    var returnData = main.responseData(id, resourceName, db, "Updated", API_DIR);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, id, [`${resourceName} id ${id} updated.`]), db, API_DIR));
};

this.remove = function (req, rsp, id, db, save, API_DIR) {
    var name;
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'DELETE', req, db);
    }

    name = db[resourceName][id].name;
    delete db[resourceName][id];
    save();

    var returnData = main.responseData(id, resourceName, db, "Deleted", API_DIR, [`${resourceName} '${name}' deleted.`]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db, API_DIR));
};

this.get = function (req, rsp, id, db, API_DIR) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (id) {
        if (!db[resourceName][id]) {
            return main.notFound(rsp, req.url, 'GET', req, db);
        }
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, singleData(db, id));
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id), db, API_DIR));
    } else {
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, listData(db, req));
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, list(db), db, API_DIR));
    }
};

async function loadData() {
    template.single = await main.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.list = await main.readFile(`${__dirname}/${resourceName}s.html.mustache`, 'utf8');
}

loadData();
