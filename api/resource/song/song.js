const fs = require("fs").promises;
const showdown  = require('showdown');
const converter = new showdown.Converter({"noHeaderId": true, "simpleLineBreaks": true});
const main = require('../../inc/main.js');

const resourceName = 'song';
const template = {};

function single(db, id, msg, error) {
    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": db[resourceName][id].name,
        "genres": main.genre(db[resourceName][id].genre1),
        "songs": main.objToArray(db[resourceName]).sort(main.sortByName),
        "formData": {
            "durationM": 0,
            "durationS": 0
        }
    }, db[resourceName][id]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function singleNoAuth(db, id, msg, error) {
    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": db[resourceName][id].name,
        "genres": main.genre(db[resourceName][id].genre1),
        "descHtml": converter.makeHtml(db[resourceName][id].desc),
        "hasVideo": (db[resourceName][id].video && (db[resourceName][id].video.fb || db[resourceName][id].video.youtube))
    }, db[resourceName][id]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function list(db, msg, error, link) {
    var resourceData = {
        [resourceName]: main.objToArray(db[resourceName]).sort(main.sortByName),
        "today": main.dateFormat(new Date()),
        "resourceName": resourceName,
        "genres": main.genre(),
        "pageName": `${main.toTitleCase(resourceName)}s`,
        "formData": {
            "durationM": 0,
            "durationS": 0
        }
    };

    return Object.assign(main.addMessages(msg, error, link), resourceData);
}

function listNoAuth(db) {
    var tzOffset = -4; // -4:00 for EDT;
    var today = new Date();
    today.setHours(tzOffset, 0, 0, 0);
    var songs = main.objToArray(db[resourceName]).filter(s => {
        var releaseDate;
        if (!s.releaseDate) {
            return true;
        }
        releaseDate = new Date(s.releaseDate);
        releaseDate.setHours(24 + tzOffset, 0, 0, 0);
        return (+today - +releaseDate >= 0);
    });
    var resourceData = {
        [resourceName]: songs.sort(main.sortByName),
        "today": main.dateFormat(new Date()),
        "resourceName": resourceName,
        "genres": main.genre(),
        "pageName": `${main.toTitleCase(resourceName)}s`
    };

    return resourceData;
}

function singleData(db, id) {
    var releases = [];

    Object.keys(db.release).forEach(rid => {
        if (db.release[rid].songs.some(s => s === id)) {
            releases.push({
                "id": rid,
                "date": db.release[rid].date,
                "name": db.release[rid].name
            });
        }
    });
    // add release info
    return Object.assign({
        "resourceName": resourceName,
        "releases": releases
    }, db[resourceName][id]);
}

function listData(db, qs) {
    var songData = main.objToArray(db[resourceName]).sort(main.sortByName);
    var tzOffset = -4; // -4:00 for EDT;
    var today = new Date();
    today.setHours(tzOffset, 0, 0, 0);
        // filter out unrelased songs
    songData = songData.filter(s => {
        var releaseDate;
        if (!s.releaseDate) {
            return true;
        }
        releaseDate = new Date(s.releaseDate);
        releaseDate.setHours(24 + tzOffset, 0, 0, 0);
        return (+today - +releaseDate >= 0);
    });

    if (qs.type === "cover") {
        songData = songData.filter(song => {
            return song.artist && song.artist !== db.band.name;
        });
    }
    if (qs.type === "original") {
        songData = songData.filter(song => {
            return !song.artist || song.artist === db.band.name;
        });
    }

    return songData;
}

// Form validation
function isUpdateInvalid(req, rsp, formData) {
    var msg = [];
    // var durationM = formData.durationM || 0;
    // durationM = parseInt(durationM);
    // var durationS = formData.durationS || 0;
    // durationS = parseInt(durationS);

    if (!formData.name) {
        msg.push('Name is required.');
    }

    // if (durationM + durationS < 1) {
    //     msg.push('Duration is required.');
    // }

    return msg;
}

function updateResource(id, formData, db, save) {
    db[resourceName][id].name = formData.name;
    db[resourceName][id].artist = formData.artist;
    db[resourceName][id].desc = formData.desc;
    db[resourceName][id].lyrics = formData.lyrics;
    db[resourceName][id].durationM = formData.durationM;
    db[resourceName][id].durationS = formData.durationS;

    db[resourceName][id].genre1 = formData.genre1;
    db[resourceName][id].genre2 = formData.genre2;
    db[resourceName][id].genre3 = formData.genre3;

    db[resourceName][id].releaseDate = formData.releaseDate;

    db[resourceName][id]["cover-front"] = formData["cover-front"];
    db[resourceName][id]["cover-back"] = formData["cover-back"];

    if (!db[resourceName][id].audio) {
        db[resourceName][id].audio = {};
    }
    db[resourceName][id].audio.spotify = formData.spotify;
    // db[resourceName][id].audio.apple = formData.apple;
    // db[resourceName][id].audio.amazon = formData.amazon;
    // db[resourceName][id].audio.youtube = formData.youtube;
    // db[resourceName][id].audio.cdbaby = formData.cdbaby;

    if (!db[resourceName][id].video) {
        db[resourceName][id].video = {};
    }
    db[resourceName][id].video.youtube = formData["video-youtube"];
    db[resourceName][id].video.fb = formData["video-fb"];

    save();
}

this.create = function (req, rsp, formData, db, save) {
    var error = isUpdateInvalid(req, rsp, formData);
    var returnData;
    if (error.length) {
        returnData = Object.assign({
            "hasError": true,
            "error": error
        }, list(db));
        returnData.formData = formData;
        returnData.genres = main.genre(formData.genre1);
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, returnData, db));
        return;
    }

    var id = main.createResource(formData, db, save, resourceName, updateResource);
    returnData = main.responseData(id, resourceName, db, "Created");

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", returnData.link);
        return main.returnJson(rsp, returnData, 201);
    }

    // returnData.back = req.headers.referer;
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
    var error = isUpdateInvalid(req, rsp, formData);
    var returnData;
    if (error.length) {
        returnData = single(db, id, "", error);
        // returnData.genres = main.genre(formData.genre1);
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, returnData, db));
        return;
    }

    // validate more fields
    updateResource(id, formData, db, save);
    returnData = main.responseData(id, resourceName, db, "Updated");

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

    name = db[resourceName][id].name;
    delete db[resourceName][id];
    save();

    var returnData = main.responseData(id, resourceName, db, "Deleted", [`${resourceName} '${name}' deleted.`]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db));
};

this.get = function (req, rsp, id, qs, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (id) {
        if (!db[resourceName][id]) {
            return main.notFound(rsp, req.url, 'GET', req, db);
        }
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, singleData(db, id));
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        if (main.isLoggedIn(req, db.user)) {
            rsp.end(main.renderPage(req, template.single, single(db, id), db));
        } else {
            rsp.end(main.renderPage(req, template.singleNoAuth, singleNoAuth(db, id), db));
        }
    } else {
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, listData(db, qs));
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        if (main.isLoggedIn(req, db.user)) {
            rsp.end(main.renderPage(req, template.list, list(db), db));
        } else {
            rsp.end(main.renderPage(req, template.listNoAuth, listNoAuth(db), db));
        }
    }
};

async function loadData() {
    template.single = await fs.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.singleNoAuth = await fs.readFile(`${__dirname}/${resourceName}-noauth.html.mustache`, 'utf8');
    template.list = await fs.readFile(`${__dirname}/${resourceName}s.html.mustache`, 'utf8');
    template.listNoAuth = await fs.readFile(`${__dirname}/${resourceName}s-noauth.html.mustache`, 'utf8');
}

loadData();
