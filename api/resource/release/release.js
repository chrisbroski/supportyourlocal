const fs = require("fs").promises;
const showdown  = require('showdown');
const converter = new showdown.Converter({"noHeaderId": true, "simpleLineBreaks": true});
const main = require('../../inc/main.js');

const resourceName = 'release';
const template = {};
var tzOffset = -4; // -4:00 for EDT;

function timestampToday() {
    var today = new Date();
    today.setHours(tzOffset, 0, 0, 0);
    return +today;
}

function canBeShown(release, targetTimestamp) {
    var startShowingOn = new Date(release.date);
    startShowingOn.setHours(24 + tzOffset, 0, 0, 0);
    var promoDate;

    // If a promotionStart date is present
    if (release.promotionStart) {
        promoDate = new Date(release.promotionStart);
        promoDate.setHours(24 + tzOffset, 0, 0, 0);
        // And promotionStart is sooner than the release date
        if (+promoDate < +startShowingOn) {
            startShowingOn = promoDate;
        }
    }
    return +startShowingOn - targetTimestamp <= 0;
}

function releaseAfterThis(r) {
    return canBeShown(r, this);
}

function songList(songs, id) {
    return songs.map(s => {
        var selected = (id === s.id) ? ' selected="selected"' : "";
        return {
            "song-id": s.id,
            "song-name": s.name,
            "selected": selected
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
    return db.song[db.release[id].songs[0]].name;
}

function songLink(db, id) {
    var link = db.release[id].audio.spotify;
    if (!link) {
        link = db.song[db.release[id].songs[0]].audio.spotify;
    }
    return link;
}

function single(db, id, msg, error) {
    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": pageName(db, id),
        "songlist": songList(main.objToArray(db.song)),
        "albumList": albumList(db[resourceName][id].songs, db),
        "front-cover-photos": main.displayPhotos(db.photo, db[resourceName][id]["cover-front"]),
        "back-cover-photos": main.displayPhotos(db.photo, db[resourceName][id]["cover-back"]),
        "no-photo": main.noPhotoSelected(db[resourceName][id].photo),
        "releases": main.objToArray(db[resourceName]).sort(main.sortByDateDesc).map(r => {
            r.releaseName = r.name || db.song[r.songs[0]].name;
            return r;
        })
    }, db[resourceName][id]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function singleNoAuth(db, id) {
    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": pageName(db, id),
        "songlist": songList(main.objToArray(db.song)),
        "hasAlbumList": db[resourceName][id].songs.length > 1,
        "albumList": albumList(db[resourceName][id].songs, db),
        "front-cover-photos": main.displayPhotos(db.photo, db[resourceName][id]["cover-front"]),
        "back-cover-photos": main.displayPhotos(db.photo, db[resourceName][id]["cover-back"]),
        "releaseLink": db[resourceName][id].audio.spotify || db.song[db[resourceName][id].songs[0]].audio.spotify,
        "descHtml": converter.makeHtml(db[resourceName][id].desc),
        "hasVideo": (db[resourceName][id].video && (db[resourceName][id].video.fb || db[resourceName][id].video.youtube))
    }, db[resourceName][id]);

    var tsToday = timestampToday();
    // if not released or promoted, return {}
    if (!canBeShown(db[resourceName][id], tsToday)) {
        return {};
    }
    // if promoted but note released, return partial data
    var releaseDate = new Date(db[resourceName][id].date);
    releaseDate.setHours(24 + tzOffset, 0, 0, 0);
    if (+releaseDate - tsToday >= 0) {
        resourceData.upcomingRelease = true;
        resourceData["cover-back"] = "";
        resourceData.credits = "";
        resourceData.audio = {};
        resourceData.video = {};
        resourceData.songs.length = 0;

        resourceData.releaseLink = "";
        resourceData.hasAlbumList = false;
        resourceData.hasVideo = false;
        return resourceData;
    }

    return resourceData;
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
        "front-cover-photos": main.displayPhotos(db.photo),
        "back-cover-photos": main.displayPhotos(db.photo),
        "no-photo": main.noPhotoSelected(),
        "pageName": `${main.toTitleCase(resourceName)}s`,
        "formData": {"date": main.dateFormat(new Date()), "promotionStart": main.dateFormat(new Date())}
    };

    return Object.assign(main.addMessages(msg, error, link), resourceData);
}

function listNoAuth(db) {
    var releases = main.objToArray(db[resourceName]).sort(main.sortByDateDesc);
    var tsToday = timestampToday();

    // Remove releases with a promoStart or release date (whichever is sooner) later than today.
    releases = releases.filter(releaseAfterThis, tsToday);

    // If release date has not happened yet, leave off song link
    releases = releases.map(r => {
        var releaseDate = new Date(r.date);
        releaseDate.setHours(24 + tzOffset, 0, 0, 0);
        if (+releaseDate - tsToday >= 0) {
            r.upcomingRelease = true;
        } else {
            r.releaseLink = songLink(db, r.id);
        }

        r.pageName = pageName(db, r.id);
        r.descHtml = converter.makeHtml(r.desc);
        return r;
    });

    return {
        [resourceName]: releases,
        "resourceName": resourceName,
        "songlist": songList(main.objToArray(db.song)),
        "photos": db.photo,
        "no-photo": main.noPhotoSelected(),
        "pageName": `${main.toTitleCase(resourceName)}s`
    };
}

function singleData(db, id) {
    var release = Object.assign({"resourceName": resourceName}, db[resourceName][id]);
    var tsToday = timestampToday();
    // if not released or promoted, return {}
    if (!canBeShown(release, tsToday)) {
        return {};
    }
    // if promoted but note released, return partial data
    var releaseDate = new Date(release.date);
    releaseDate.setHours(24 + tzOffset, 0, 0, 0);
    if (+releaseDate - tsToday >= 0) {
        release["cover-back"] = "";
        release.credits = "";
        release.audio = {};
        release.video = {};
        release.songs.length = 0;
        return release;
    }

    release.songs = release.songs.map(s => {
        return Object.assign({"id": s}, db.song[s]);
    });
    return release;
}

function addSongData(release, db) {
    release.songs = release.songs.map(s => {
        return Object.assign({"id": s}, db.song[s]);
    });
    return release;
}

function listData(db) {
    var releases = main.objToArray(db[resourceName]).sort(main.sortByDateDesc);
    var tsToday = timestampToday();

    releases = releases.filter(releaseAfterThis, tsToday);

    return releases.map(r => {
        var releaseDate = new Date(r.date);
        releaseDate.setHours(24 + tzOffset, 0, 0, 0);
        if (+releaseDate - tsToday >= 0) {
            // r.upcomingRelease = true;
            r["cover-back"] = "";
            r.credits = "";
            r.audio = {};
            r.video = {};
            r.songs.length = 0;
        }
        return addSongData(r, db);
    });
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

    if (!formData.name && !hasSong) {
        msg.push('You must give your release a title or a song.');
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
    db[resourceName][id].promotionStart = formData.promotionStart;
    db[resourceName][id].desc = formData.desc;
    db[resourceName][id].credits = formData.credits;

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
    db[resourceName][id].video.youtube = formData.youtube;
    db[resourceName][id].video.fb = formData.fb;

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

this.addSong = function (req, rsp, id, formData, db, save) {
    // if (isSongInvalid(req, rsp, id, formData, db)) {
    //     return;
    // }

    // var id = main.createResource(formData, db, save, resourceName, updateResource);
    // var returnData = main.responseData(id, resourceName, db, "Song Added", ["Song added"]);
    var error = isSongInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, Object.assign({
            "hasError": true,
            "error": error,
            "formData": formData
        }, list(db)), db));
        // ^ this needs selected values too
        return;
    }
    // var id = main.createResource(formData, db, save, resourceName, updateResource);
    // var returnData = main.responseData(id, resourceName, db, "Song Added", ["Song added"]);
    if (formData["song-id"]) {
        db[resourceName][id].songs.push(formData["song-id"]);
    }
    save();

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", `${process.env.SUBDIR}/${resourceName}/${id}`);
        return main.returnJson(rsp, {}, 201);
    }

    // returnData.back = req.headers.referer;
    rsp.writeHead(201, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, id, ["Song added"]), db));
};

this.reorderSong = function(req, rsp, id, formData, db, save) {
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

this.create = function (req, rsp, formData, db, save) {
    var error = isUpdateInvalid(formData, db, id);
    var returnData;
    if (error.length) {
        returnData = Object.assign({
            "hasError": true,
            "error": error
        }, list(db));
        returnData.formData = formData;
        returnData["front-cover-photos"] = main.displayPhotos(db.photo, formData["cover-front"]);
        returnData["back-cover-photos"] = main.displayPhotos(db.photo, formData["cover-back"]);
        returnData.songlist = songList(main.objToArray(db.song), formData["initial-song"]);
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
    var error = isUpdateInvalid(formData, db, id);
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
        if (main.isLoggedIn(req, db.user)) {
            rsp.end(main.renderPage(req, template.single, single(db, id), db));
        } else {
            rsp.end(main.renderPage(req, template.singleNoAuth, singleNoAuth(db, id), db));
        }
    } else {
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, listData(db, req));
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
