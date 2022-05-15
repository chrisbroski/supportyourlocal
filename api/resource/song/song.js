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
        "mediaList": mediaList(db[resourceName][id].media),
        "formData": {
            "durationM": 0,
            "durationS": 0
        }
    }, db[resourceName][id]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function mediaList(media) {
    if (!media) {
        return [];
    }
    return media.map((s, i) => {
        return {
            "media-url": s.url,
            "media-type": s.type,
            "media-index": i
        };
    });
}

function domain(url) {
    var reUrl = /.*\:\/\/([^\/]*)(\/|\?|$)/;
    var results = reUrl.exec(url);
    if (!results) {
        return "";
    }
    var domain = results[1];
    // remove any sub-domains
    var hasSubDomains = domain.lastIndexOf(".", domain.lastIndexOf(".") - 1);
    if (hasSubDomains > -1) {
        domain = domain.slice(hasSubDomains + 1);
    }
    return domain.charAt(0).toUpperCase() + domain.substr(1);
}

function mediaAction(type) {
    var actions = {
        "audio": "Listen",
        "video": "Watch",
        "article": "Read"
    };
    return actions[type];
}

function singleNoAuth(db, id, msg, error) {
    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": db[resourceName][id].name,
        "genres": main.genre(db[resourceName][id].genre1),
        "descHtml": converter.makeHtml(db[resourceName][id].desc),
        "mediaLinks": db[resourceName][id].media.map(m => {
            return {
                "url": m.url,
                "domain": domain(m.url),
                "action": mediaAction(m.type)
            };
        })
        // "hasVideo": (db[resourceName][id].video && (db[resourceName][id].video.fb || db[resourceName][id].video.youtube))
    }, db[resourceName][id]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function list(db, msg, error, link) {
    var resourceData = {
        [resourceName]: main.objToArray(db[resourceName]).sort(main.sortByName),
        "today": main.dateFormat(new Date()),
        "resourceName": resourceName,
        "genres": main.genre(),
        "media": main.media(),
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

function isReorderInvalid(formData) {
    var msg = [];

    if (!formData["media-index"]) {
        msg.push('Media index is required.');
    }
    if (!formData.index) {
        msg.push('New index is required.');
    }
    return msg;
}

function patchResource(id, formData, db, save) {
    var currentIndex = formData["media-index"];
    var newIndex = formData.index;
    if (newIndex >= db[resourceName][id].media.length) {
        newIndex = db[resourceName][id].media.length - 1;
    }
    var removedMedium = db[resourceName][id].media.splice(currentIndex, 1);
    if (parseInt(formData.index) > -1) {
        db[resourceName][id].media.splice(newIndex, 0, removedMedium);
    }

    save();
}

this.reorderMedia = function(req, rsp, id, formData, db, save) {
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'PATCH', req, db);
    }

    var error = isReorderInvalid(formData, db, id);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id, "", error), db));
        return;
    }

    patchResource(id, formData, db, save);
    var returnData = main.responseData(id, resourceName, db, "Updated");

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, id, [`${resourceName} id ${id} songs updated.`]), db));
};

function isMediaInvalid(formData) {
    var msg = [];
    // var durationM = formData.durationM || 0;
    // durationM = parseInt(durationM);
    // var durationS = formData.durationS || 0;
    // durationS = parseInt(durationS);

    if (!formData.media) {
        msg.push('Media URL is required.');
    }

    if (!formData.type) {
        msg.push('Media type is required.');
    }

    // if (durationM + durationS < 1) {
    //     msg.push('Duration is required.');
    // }

    return msg;
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

    // maybe add one media to start?
    if (!db[resourceName][id].media) {
        db[resourceName][id].media = [];
    }
    if (formData.media) {
        db[resourceName][id].media.push({
            "url": formData.media,
            "type": formData.type || "audio"
        });
    }

    save();
}

this.addMedia = function (req, rsp, id, formData, db, save) {
    var error = isMediaInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, Object.assign({
            "hasError": true,
            "error": error,
            "formData": formData
        }, list(db)), db));
        return;
    }
    if (!db[resourceName][id].media) {
        db[resourceName][id].media = [];
    }
    db[resourceName][id].media.unshift({
        "url": formData.media,
        "type": formData.type
    });
    save();

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", `${process.env.SUBDIR}/${resourceName}/${id}`);
        return main.returnJson(rsp, {}, 201);
    }

    // returnData.back = req.headers.referer;
    rsp.writeHead(201, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, id, ["Media added"]), db));
};

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
        returnData.media = main.media(formData.media);
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
