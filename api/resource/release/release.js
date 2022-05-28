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
    return songs.map((s, i) => {
        return {
            "song-id": s,
            "song-name": db.song[s].name,
            "song-order": i,
            "song-up": i - 1,
            "song-down": i + 1,
            "song-top": i === 0,
            "song-bottom": i >= songs.length - 1
        };
    });
}

function single(db, id, msg, error) {
    var releases = main.objToArray(db[resourceName]).sort(main.sortByDateDesc);
    releases = releases.map(r => {
        r.pageName = main.releaseName(db, r.id);
        return r;
    });
    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": main.releaseName(db, id),
        "songlist": songList(main.objToArray(db.song)),
        "albumList": albumList(db[resourceName][id].songs, db),
        "front-cover-photos": main.displayPhotos(db.photo, db[resourceName][id]["cover-front"]),
        "back-cover-photos": main.displayPhotos(db.photo, db[resourceName][id]["cover-back"]),
        "no-photo": main.noPhotoSelected(db[resourceName][id].photo),
        "mediaList": main.mediaList(db[resourceName][id].media),
        "releases": releases
    }, db[resourceName][id]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function expandPhotos(db, releaseData) {
    var expandedReleaseData = Object.assign({}, releaseData);
    expandedReleaseData["cover-front"] = main.photoWeb(db, expandedReleaseData["cover-front"]);
    expandedReleaseData["cover-back"] = main.photoWeb(db, expandedReleaseData["cover-back"]);
    return expandedReleaseData;
}

function releaseMediaByType(db, id, type) {
    var media = db[resourceName][id].media;
    if (!media.some(m => m.type === type && db[resourceName][id].songs.length === 1)) {
        media = db.song[db[resourceName][id].songs[0]].media;
    }
    return media.filter(m => m.type === type).map(m => {
        return {
            "url": m.url,
            "domain": main.domain(m.url)
        };
    });
}

function singleNoAuth(db, id) {
    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": main.releaseName(db, id),
        "songlist": songList(main.objToArray(db.song)),
        "hasAlbumList": db[resourceName][id].songs.length > 1,
        "albumList": albumList(db[resourceName][id].songs, db),
        "releaseLink": main.songLink(db, id),
        "descHtml": converter.makeHtml(db[resourceName][id].desc),
        "hasVideo": releaseMediaByType(db, id, "video").length > 0,
        "audioMedia": releaseMediaByType(db, id, "audio"),
        "videoMedia": releaseMediaByType(db, id, "video"),
        "blogMedia": releaseMediaByType(db, id, "article")
    }, expandPhotos(db, db[resourceName][id]));

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
        resourceData.audio = {}; // deprecated
        resourceData.video = {}; // deprecated
        resourceData.songs.length = 0;

        resourceData.releaseLink = "";
        resourceData.hasAlbumList = false;
        resourceData.hasVideo = false;
        resourceData.audioMedia = [];
        resourceData.videoMedia = [];
        resourceData.blogMedia = [];
        return resourceData;
    }

    return resourceData;
}

function list(db, msg, error, link) {
    var releases = main.objToArray(db[resourceName]).sort(main.sortByDateDesc);
    releases = releases.map(r => {
        r.pageName = main.releaseName(db, r.id);
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
        "media": main.media(),
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
            r.releaseLink = main.songLink(db, r.id);
        }
        r["cover-front"] = main.photoWeb(db, r["cover-front"]);
        r["cover-back"] = main.photoWeb(db, r["cover-back"]);

        r.pageName = main.releaseName(db, r.id);
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

function getReleaseSpotifyAudio(db, id) {
    var audio = db.release[id].media.filter(m => {
        return m.type === "audio" && m.url.indexOf("open.spotify.com") > -1;
    });
    if (audio.length === 0 && db.release[id].songs.length === 1) {
        audio = db.song[db.release[id].songs[0]].media.filter(m => {
            return m.type === "audio" && m.url.indexOf("open.spotify.com") > -1;
        });
    }
    if (audio.length > 0) {
        return audio[0].url;
    }
    return "";
}

function getReleaseVideo(db, id) {
    var videoData = {"youtube": "", "fb": ""};
    var media = db.release[id].media;
    if (media.filter(m => m.type === "video").length === 0 && db.release[id].songs.length === 1) {
        media = db.song[db.release[id].songs[0]].media;
    }
    media.forEach(m => {
        if (m.type === "video" && m.url.indexOf("facebook.com") > -1) {
            videoData.fb = m.url;
        }
        if (m.type === "video" && m.url.indexOf("youtube.com") > -1) {
            videoData.youtube = m.url;
        }
        if (m.type === "video" && m.url.indexOf("youtu.be") > -1) {
            videoData.youtube = m.url;
        }
    });
    return videoData;
}

function getSpotifyAudio(media) {
    var audio = media.filter(m => {
        return m.type === "audio" && m.url.indexOf("open.spotify.com") > -1;
    });
    if (audio.length > 0) {
        return audio[0].url;
    }
    return "";
}

function backCompatAudio(song) {
    var media = song.media.filter(m => m.type === "audio" && m.url.indexOf("spotify.com") > -1);
    var audioData = {"spotify": ""};
    if (media.length > 0) {
        audioData.spotify = media[0].url;
    }
    return audioData;
}

function backCompatVideo(song) {
    var videoData = {"youtube": "", "fb": ""};
    song.media.forEach(m => {
        if (m.type === "video" && m.url.indexOf("facebook.com") > -1) {
            videoData.fb = m.url;
        }
        if (m.type === "video" && m.url.indexOf("youtube.com") > -1) {
            videoData.youtube = m.url;
        }
        if (m.type === "video" && m.url.indexOf("youtu.be") > -1) {
            videoData.youtube = m.url;
        }
    });
    return videoData;
}

function singleData(db, id) {
    var release = Object.assign({"resourceName": resourceName}, db[resourceName][id]);
    var tsToday = timestampToday();
    // if not released or promoted, return {}
    if (!canBeShown(release, tsToday)) {
        return {};
    }
    release["cover-front"] = main.photoWeb(db, release["cover-front"]);
    release["cover-back"] = main.photoWeb(db, release["cover-back"]);
    release.audio = {"spotify": getReleaseSpotifyAudio(db, id)};
    release.video = getReleaseVideo(db, id);
    // release.video = getReleaseVideo(db){"spotify": getReleaseSpotifyAudio(db, id)};
    // if promoted but note released, return partial data
    var releaseDate = new Date(release.date);
    releaseDate.setHours(24 + tzOffset, 0, 0, 0);
    if (+releaseDate - tsToday >= 0) {
        release.upcomingRelease = true;
        release["cover-back"] = "";
        release.credits = "";
        release.audio = {};
        release.video = {};
        release.songs.length = 0;
        return release;
    }

    release.songs = release.songs.map(s => {
        return Object.assign({
            "id": s,
            "audio": backCompatAudio(db.song[s]),
            "video": backCompatVideo(db.song[s])
        }, db.song[s]);
    });
    return release;
}

function addSongData(release, db) {
    release.songs = release.songs.map(s => {
        var songData = Object.assign({"id": s}, db.song[s]);
        songData.audio = {"spotify": getSpotifyAudio(db.song[s].media)};
        return songData;
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

        r["cover-front"] = main.photoWeb(db, r["cover-front"]);
        r["cover-back"] = main.photoWeb(db, r["cover-back"]);
        r.audio = {"spotify": getReleaseSpotifyAudio(db, r.id)};

        if (+releaseDate - tsToday >= 0) {
            r.upcomingRelease = true;
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

function isAddInvalid(formData) {
    var msg = [];

    if (!formData["song-id"] && !formData.media) {
        msg.push('Song or media id is required.');
    }
    // Make sure it is not a duplicate song
    // maybe check that the song id is valid too

    return msg;
}

function isMediaInvalid(formData) {
    var msg = [];

    if (!formData.media) {
        msg.push('Media URL is required.');
    }

    if (!formData.type) {
        msg.push('Media type is required.');
    }

    return msg;
}

function isReorderInvalid(formData, db, id) {
    var msg = [];

    if (!formData["song-id"] && !formData["media-index"]) {
        msg.push('Song or Media index is required.');
    }
    if (!formData.index) {
        msg.push('New index is required.');
    }
    if (formData["song-id"] && db.release[id].songs.indexOf(formData["song-id"]) < 0) {
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

    // if (!db[resourceName][id].audio) {
    //     db[resourceName][id].audio = {};
    // }
    // db[resourceName][id].audio.spotify = formData.spotify;
    // db[resourceName][id].audio.apple = formData.apple;
    // db[resourceName][id].audio.amazon = formData.amazon;
    // db[resourceName][id].audio.youtube = formData.youtube;
    // db[resourceName][id].audio.cdbaby = formData.cdbaby;

    // if (!db[resourceName][id].video) {
    //     db[resourceName][id].video = {};
    // }
    // db[resourceName][id].video.youtube = formData.youtube;
    // db[resourceName][id].video.fb = formData.fb;

    if (!db[resourceName][id].songs) {
        db[resourceName][id].songs = [];
    }
    if (formData["initial-song"]) {
        db[resourceName][id].songs.push(formData["initial-song"]);
    }

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

function patchResource(id, formData, db, save) {
    if (formData["song-id"]) {
        patchSong(id, formData, db, save);
    } else {
        patchMedia(id, formData, db, save);
    }
}

function patchMedia(id, formData, db, save) {
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

function patchSong(id, formData, db, save) {
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

function addMedia(req, rsp, id, formData, db, save) {
    var error = isMediaInvalid(formData);

    // this can be called from either the single or list page.
    // Figure out proper error redirect
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, Object.assign({
            "hasError": true,
            "error": error,
            "formData": formData
        }, single(db, id)), db));
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

    rsp.writeHead(201, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, id, ["Media added"]), db));
}

this.addItem  = function (req, rsp, id, formData, db, save) {
    var error = isAddInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, Object.assign({
            "hasError": true,
            "error": error,
            "formData": formData
        }, single(db, id)), db));
        // ^ this needs selected values too
        return;
    }
    if (formData["song-id"]) {
        addSong(req, rsp, id, formData, db, save);
    } else {
        addMedia(req, rsp, id, formData, db, save);
    }
};

// Album track errors should display in the lower section
function addSong(req, rsp, id, formData, db, save) {
    // if (isSongInvalid(req, rsp, id, formData, db)) {
    //     return;
    // }

    // var id = main.createResource(formData, db, save, resourceName, updateResource);
    // var returnData = main.responseData(id, resourceName, db, "Song Added", ["Song added"]);
    var error = isSongInvalid(formData);

    // this can be called from either the single or list page.
    // Figure out proper error redirect
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, Object.assign({
            "hasError": true,
            "error": error,
            "formData": formData
        }, single(db, id)), db));
        // ^ this needs selected values too
        return;
    }

    if (formData["song-id"]) {
        db[resourceName][id].songs.push(formData["song-id"]);
    }
    save();

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", `${process.env.SUBDIR}/${resourceName}/${id}`);
        return main.returnJson(rsp, {}, 201);
    }

    rsp.writeHead(201, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, id, ["Song added"]), db));
}

this.reorderItem = function(req, rsp, id, formData, db, save) {
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'PATCH', req, db);
    }

    var error = isReorderInvalid(formData, db, id);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id, "", error), db));
        return;
    }

    if (formData["song-id"]) {
        reorderSong(req, rsp, id, formData, db, save);
    } else {
        reorderMedia(req, rsp, id, formData, db, save);
    }
};

function reorderMedia(req, rsp, id, formData, db, save) {
    patchResource(id, formData, db, save);
    var returnData = main.responseData(id, resourceName, db, "Updated");

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, id, [`${resourceName} id ${id} media updated.`]), db));
}

function reorderSong(req, rsp, id, formData, db, save) {
    patchResource(id, formData, db, save);
    var returnData = main.responseData(id, resourceName, db, "Updated");

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, id, [`${resourceName} id ${id} media updated.`]), db));
}

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
