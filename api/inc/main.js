const fs = require("fs").promises;
const crypto = require("crypto");

const mustache = require("mustache");

const countries = require('./countries.json');
const genres = require('./genres.json');
const mediums = require('./media.json');

const TEMPLATE = {};

function removeQs(fullUrl) {
    if (!fullUrl) {
        return '';
    }
    if (fullUrl.indexOf('?') === -1) {
        return fullUrl;
    }
    return fullUrl.slice(0, fullUrl.indexOf('?'));
}

function regexExtract(pattern, source) {
    var value = "";
    var reId = new RegExp(pattern, "i");
    var result;

    if (source.slice(-1) !== "/") {
        source = source + "/";
    }

    result = reId.exec(source);
    if (result) {
        value = result[1];
    }
    return decodeURIComponent(value);
}

function extractFileType(path) {
    var lastDot;
    if (!path) {
        return "";
    }
    lastDot = path.lastIndexOf(".");
    if (lastDot === -1) {
        return "";
    }
    return path.slice(lastDot + 1);
}

this.getPath = function (pathname) {
    var path;
    var qs = parseQs(pathname, true);
    var raw = pathname;
    pathname = removeQs(pathname);
    path = pathname.slice(process.env.SUBDIR.length);
    if (!path) {
        return {"pathname": pathname, id: "", resource: ""};
    }

    var resource = regexExtract("^\/([^\/]+)[\/]", path);
    return {
        "id": regexExtract('^\/' + resource + '\/([^\/]+)', path),
        "pathname": decodeURI(pathname),
        "resource": resource,
        "path": path,
        "type": extractFileType(path),
        "qs": qs,
        "raw": raw
    };
};

function parseQs(qs, requireQuestion) {
    var questionIndex = qs.indexOf("?");
    if (questionIndex > -1) {
        qs = qs.slice(questionIndex + 1);
    } else if (requireQuestion) {
        return {};
    }
    return Object.fromEntries(new URLSearchParams(qs));
}
this.parseQs = parseQs;

function genre(selected) {
    var displayGenres = [];
    genres.forEach(g => {
        var sel = "";
        if (selected === g) {
            sel = ' selected="selected"';
        }
        displayGenres.push({
            "name": g,
            "selected": sel
        });
    });
    return displayGenres;
}
this.genre = genre;

function media(selected) {
    var displayMedia = [];
    mediums.forEach(g => {
        var sel = "";
        if (selected === g) {
            sel = ' selected="selected"';
        }
        displayMedia.push({
            "name": g,
            "selected": sel
        });
    });
    return displayMedia;
}
this.media = media;

function country(selected) {
    var displayCountries = [];
    selected = selected || "US";
    Object.keys(countries).forEach(c => {
        var sel = "";
        if (selected === c) {
            sel = ' selected="selected"';
        }
        displayCountries.push({
            "code": c,
            "name": countries[c],
            "selected": sel
        });
    });
    return displayCountries;
}
this.country = country;

function getMediumUrl(media, domain, type) {
    var filteredMedia = media.filter(m => {
        return m.type === type && m.url.indexOf(domain) > -1;
    });

    var spotifyMedium = "";
    if (filteredMedia.length > 0) {
        spotifyMedium = filteredMedia[0].url;
    }

    return spotifyMedium;
}
this.getMediumUrl = getMediumUrl;

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
this.mediaList = mediaList;

function photoWeb(db, photoId) {
    if (!db.photo[photoId]) {
        return photoId;
    }
    if (db.photo[photoId].web) {
        return `${db.photo[photoId].name}_web${db.photo[photoId].ext}`;
    }
    return photoId;
}
this.photoWeb = photoWeb;

function displayPhotos(photos, selected) {
    var photoData = [];
    var selectedIdx;
    var selectedPhoto;
    Object.keys(photos).forEach((p, idx) => {
        var sel = '';
        if (selected === p) {
            sel = ' checked="checked"';
            selectedIdx = idx;
        }
        photoData.push({
            "file": p,
            "selected": sel,
            "thumb": `${photos[p].name}_thumb${photos[p].ext}`
        });
    });
    if (selectedIdx) {
        selectedPhoto = photoData.splice(selectedIdx, 1);
        photoData.unshift(selectedPhoto[0]);
    }
    return photoData;
}
this.displayPhotos = displayPhotos;

function noPhotoSelected(photoValue) {
    var sel = '';
    if (!photoValue) {
        sel = ' checked="checked"';
    }
    return sel;
}
this.noPhotoSelected = noPhotoSelected;

function songLink(db, releaseId) {
    var mediums;
    var link = "";
    if (db.release[releaseId].media.length > 0) {
        mediums = db.release[releaseId].media.filter(m => {
            return m.type === "audio";
        });
        if (mediums.length > 0) {
            link = mediums[0].url;
        }
    }
    if (!link && db.release[releaseId].songs.length === 1) {
        mediums = db.song[db.release[releaseId].songs[0]].media.filter(m => {
            return m.type === "audio";
        });
        if (mediums.length > 0) {
            link = mediums[0].url;
        }
    }
    return link;
}
this.songLink = songLink;

function songLinks(db, releaseId) {
    var mediums;
    var releases;
    if (!releaseId) {
        //get latest releaseId
        releases = objToArray(db.release).sort(sortByDateDesc);
        if (releases.length > 0) {
            releaseId = releases[0].id;
        } else {
            return [];
        }
    }
    if (!db.release[releaseId]) {
        return [];
    }
    if (db.release[releaseId].media.length > 0) {
        mediums = db.release[releaseId].media.filter(m => {
            return m.type === "audio";
        });
        if (mediums.length > 0) {
            return mediums.map(m => m.url);
        }
    }
    if (db.release[releaseId].songs.length === 1) {
        mediums = db.song[db.release[releaseId].songs[0]].media.filter(m => {
            return m.type === "audio";
        });
        if (mediums.length > 0) {
            return mediums.map(m => m.url);
        }
    }
    return [];
}
this.songLinks = songLinks;

function releaseName(db, releaseId) {
    if (db.release[releaseId].name) {
        return db.release[releaseId].name;
    }
    if (db.release[releaseId].songs.length > 0) {
        return db.song[db.release[releaseId].songs].name;
    }
    return "";
}
this.releaseName = releaseName;

const timeZones = {
    "EST": "-0500",
    "EDT": "-0400",
    "CST": "-0600",
    "CDT": "-0500",
    "MST": "-0700",
    "MDT": "-0600",
    "PST": "-0800",
    "PDT": "-0700",
};

function getTzOffset(timeZone) {
    if (timeZones[timeZone]) {
        return timeZones[timeZone];
    }
    return "+0000";
}

function makeTimestamp(date, time, tz) {
    tz = tz || "GMT";
    return +(new Date(`${date}T${time}${getTzOffset(tz)}`));
}
this.makeTimestamp = makeTimestamp;

function hash(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 1, 63, 'sha512').toString('base64');
}
this.hash = hash;

function zeroPad(n) {
    if (n < 10) {
        return '0' + n;
    }
    return n.toString(10);
}
this.zeroPad = zeroPad;

function dateFormat(d) {
    var date = new Date(d);
    return date.getFullYear() + '-' + zeroPad(date.getMonth() + 1) + '-' + zeroPad(date.getDate());
}
this.dateFormat = dateFormat;

function objToArray(obj) {
    if (!obj) {
        return [];
    }
    return Object.keys(obj).map(function (key) {
        return Object.assign({"id": key}, obj[key]);
    });
}
this.objToArray = objToArray;

function makeId(bytes) {
    bytes = bytes || 24;
    const id = crypto.randomBytes(bytes).toString("base64");
    return id.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/, ".");
}
this.makeId = makeId;

// From https://stackoverflow.com/a/5624139/468111
function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}
this.hexToRgb = hexToRgb;

function toTitleCase(str) {
    if (!str) {
        return "";
    }
    return str.replace(/\w\S*/g, word => {
        return word.charAt(0).toUpperCase() + word.substr(1);
    });
}
this.toTitleCase = toTitleCase;

function sortByName(a, b) {
    if (a.name < b.name){
        return -1;
    }
    if (a.name > b.name){
        return 1;
    }
    return 0;
}
this.sortByName = sortByName;

function sortByDate(a, b) {
    var dateA = (a.date) ? (new Date(a.date)).getTime() : 0;
    var dateB = (b.date) ? (new Date(b.date)).getTime() : 0;
    return dateA - dateB;
}
this.sortByDate = sortByDate;

function sortByDateDesc(a, b) {
    var dateA = (a.date) ? (new Date(a.date)).getTime() : 0;
    var dateB = (b.date) ? (new Date(b.date)).getTime() : 0;
    return dateB - dateA;
}
this.sortByDateDesc = sortByDateDesc;

function extractSpotifyTrackId(shareLink) {
    if (!shareLink) {
        return "";
    }
    var reQs, val;
    reQs = new RegExp("[.*]spotify.com/track/([^?#]*)", "i");
    val = reQs.exec(shareLink);
    if (val) {
        return val[1];
    }
    return "";
}
this.extractSpotifyTrackId = extractSpotifyTrackId;

function addMessages(msg, error, link) {
    var returnData = {};
    if (msg) {
        returnData.hasMsg = true;
        returnData.msg = msg;
    }

    if (error) {
        returnData.hasError = true;
        returnData.error = error;
    }

    if (link) {
        returnData.hasMsg = true;
        returnData.link = link;
    }
    return returnData;
}
this.addMessages = addMessages;

function createResource(formData, db, save, resourceName, updateResource) {
    var id = makeId();
    if (!db[resourceName]) {
        db[resourceName] = {};
    }
    db[resourceName][id] = {};
    updateResource(id, formData, db, save);
    return id;
}
this.createResource = createResource;

function responseData(id, resourceName, db, action, msg) {
    var responseJson = {
        "id": id
    };
    if (resourceName && id) {
        responseJson.data = db[resourceName][id];
        responseJson.link = `${process.env.SUBDIR}/${resourceName}/${id}`;
        responseJson.title = `${action} ${toTitleCase(resourceName)}`;
    }

    if (action === "Deleted" && resourceName) {
        responseJson.link = `${process.env.SUBDIR}/${resourceName}/`;
    }

    if (msg && msg.length > 0) {
        responseJson.msg = [];
        msg.forEach(m => {
            responseJson.msg.push(m);
        });
    }
    return responseJson;
}
this.responseData = responseData;

function isMod(req, db) {
    var userData = getAuthUserData(req, db.user);
    if (!userData) {
        return false;
    }
    return (userData.admin === "Y");
}
this.isMod = isMod;

function notFound(rsp, url, verb, req, db) {
    if (req.headers.accept === "application/json") {
        rsp.writeHead(404, {'Content-Type': 'application/json'});
        rsp.end(JSON.stringify({
            "msg": [`Invalid ${verb} request ${url}`]
        }));
        return;
    }

    rsp.writeHead(404, {'Content-Type': 'text/html'});
    rsp.end(renderPage(req, null, {
        "resourceName": "404 Not Found",
        "title": "Not Found (404)",
        "msg": [`Invalid ${verb} request ${url}`]
    }, db));
    return;
}
this.notFound = notFound;

function getUserIdByEmail(email, users) {
    if (!email) {
        return "";
    }
    email = email.toLowerCase();

    return Object.keys(users).reduce(function (a, b) {
        if (users[b] && users[b].email && users[b].email.toLowerCase() === email) {
            return b;
        }
        return a;
    }, "");
}
this.getUserIdByEmail = getUserIdByEmail;

function renderPage(req, pageTemplate, d, db) {
    var userData = getAuthUserData(req, db.user);
    var loggedIn = true;

    pageTemplate = pageTemplate || TEMPLATE.generic;

    if (!userData || !userData.userid || userData.userid === 'logout') {
        userData = false;
        loggedIn = false;
    }

    var header = mustache.render(TEMPLATE.header, {
        "auth": userData,
        "site": db.site,
        "server": req.headers.host,
        "loggedIn": loggedIn,
        "API_DIR": process.env.SUBDIR
    });

    var head = mustache.render(TEMPLATE.head, {
        "cssVersion": cssVer,
        "API_DIR": process.env.SUBDIR
    });

    var messageDisplay = mustache.render(TEMPLATE.msg, {
        "hasError": d.hasError,
        "error": d.error,
        "hasMsg": d.hasMsg,
        "msg": d.msg,
        "link": d.link
    });

    return mustache.render(pageTemplate, Object.assign({
        "loggedIn": loggedIn,
        "header": header,
        "head": head,
        "isMod": !!userData.admin,
        "userid": userData.userid,
        "homeName": db.band.name,
        "message-display": messageDisplay,
        "resourceNameCap": toTitleCase(d.resourceName),
        "API_DIR": process.env.SUBDIR
    }, d));
}
this.renderPage = renderPage;

this.returnJson = function (rsp, jsonData, statusCode) {
    statusCode = statusCode || 200;
    rsp.writeHead(statusCode, {'Content-Type': 'application/json'});
    rsp.end(JSON.stringify(jsonData));
    return;
};

function parseCookie(cookie) {
    var parsedCookies = {};
    if (!cookie) {
        return parsedCookies;
    }
    var cookies = cookie.split("; ");
    cookies.forEach(function (c) {
        var splitCookie = c.split("=");
        parsedCookies[splitCookie[0]] = splitCookie[1];
    });
    return parsedCookies;
}
this.parseCookie = parseCookie;

function getAuthUserData(req, users) {
    var cookies = parseCookie(req.headers.cookie);
    var userId = cookies.user;

    if (!userId) {
        return false;
    }
    if (!users[userId]) {
        return false;
    }
    // Check auth token
    if (hash(users[userId].password + userId, users[userId].salt) !== cookies.token) {
        return false;
    }
    return Object.assign({"userid": userId}, users[userId]);
}
this.getAuthUserData = getAuthUserData;

function isLoggedIn(req, users) {
    var userData = getAuthUserData(req, users);
    return (userData && userData.userid && userData.userid !== 'logout');
}
this.isLoggedIn = isLoggedIn;

var cssVer;
async function loadData() {
    TEMPLATE.head = await fs.readFile(`${__dirname}/head.pht.mustache`, 'utf8');
    TEMPLATE.header = await fs.readFile(`${__dirname}/header.pht.mustache`, 'utf8');
    TEMPLATE.generic = await fs.readFile(`${__dirname}/generic.html.mustache`, 'utf8');
    TEMPLATE.msg = `{{#hasError}}
<ul class="msg error">
{{#error}}
<li>{{.}}</li>
{{/error}}
</ul>
{{/hasError}}

{{#hasMsg}}
<ul class="msg">
{{#msg}}
<li>{{.}}</li>
{{/msg}}
{{#link}}
<li><a href="{{href}}">{{text}}</a></li>
{{/link}}
</ul>
{{/hasMsg}}`;

    const fileStats = await fs.stat(`${__dirname}/main.css`);
    cssVer = +fileStats.mtime;
}

loadData();
