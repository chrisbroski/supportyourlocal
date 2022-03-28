const fs = require("fs");
const util = require('util');
const crypto = require("crypto");
const readFile = util.promisify(fs.readFile);
const fileStat = util.promisify(fs.stat);
this.readFile = readFile;

const mustache = require("mustache");
require('dotenv').config({path: `${__dirname}/.env`});

const TEMPLATE = {};

function parseQs(qs, requireQuestion) {
    var questionIndex = qs.indexOf("?");
    if (questionIndex > -1) {
        qs = qs.slice(questionIndex + 1);
    } else if (requireQuestion) {
        return {};
    }
    return Object.fromEntries(new URLSearchParams(qs));
}

function removeQs(fullUrl) {
    if (!fullUrl) {
        return '';
    }
    if (fullUrl.indexOf('?') === -1) {
        return fullUrl;
    }
    return fullUrl.slice(0, fullUrl.indexOf('?'));
}

function extractResource(pathname) {
    var resource = "";
    var reResource;
    var val;

    if (pathname.slice(-1) !== "/") {
        pathname = pathname + "/";
    }
    reResource = new RegExp("^\/([^\/]+)[\/]", "i");
    val = reResource.exec(pathname);
    if (val) {
        resource = val[1];
    }
    return decodeURIComponent(resource);
}

function extractId(pathname, resource) {
    var id = "";
    var reId;
    var val;

    if (pathname.slice(-1) !== "/") {
        pathname = pathname + "/";
    }

    reId = new RegExp('^\/' + resource + '\/([^\/]+)', "i");
    val = reId.exec(pathname);
    if (val) {
        id = val[1];
    }
    return decodeURIComponent(id);
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

function getPath(pathname, API_DIR) {
    var path;
    var qs = parseQs(pathname, true);
    var raw = pathname;
    pathname = removeQs(pathname);
    path = pathname.slice(API_DIR.length);
    if (!path) {
        return {"pathname": pathname, id: "", resource: ""};
    }

    var resource = extractResource(path);
    return {
        "id": extractId(path, resource),
        "pathname": decodeURI(pathname),
        "resource": resource,
        "path": path,
        "type": extractFileType(path),
        "qs": qs,
        "raw": raw
    };
}
this.getPath = getPath;

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

function createResource(formData, db, save, resourceName, updateResource) {
    var id = makeId();
    db[resourceName][id] = {};
    updateResource(id, formData, db, save);
    return id;
}
this.createResource = createResource;

function responseData(id, resourceName, db, action, API_DIR, msg) {
    var responseJson = {
        "id": id
    };
    if (resourceName && id) {
        responseJson.data = db[resourceName][id];
        responseJson.link = `${API_DIR}/${resourceName}/${id}`;
        responseJson.title = `${action} ${toTitleCase(resourceName)}`;
    }

    if (action === "Deleted" && resourceName) {
        responseJson.link = `${API_DIR}/${resourceName}/`;
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

function invalidMsg(rsp, msg, req, db, API_DIR) {
    if (!msg.length) {
        return false;
    }

    if (req.headers.accept === "application/json") {
        rsp.writeHead(400, {'Content-Type': 'application/json'});
        rsp.end(JSON.stringify(msg));
        return true;
    }

    // this should go back to its own page with messages
    rsp.writeHead(400, {'Content-Type': 'text/html'});
    rsp.end(renderPage(req, null, {
        "resourceName": "400 Bad Request",
        "title": "Invalid Request (400)",
        "msg": msg
    }, db, API_DIR));
    return true;
}
this.invalidMsg = invalidMsg;

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

function renderPage(req, pageTemplate, d, db, API_DIR) {
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
        "API_DIR": API_DIR
    });

    var head = mustache.render(TEMPLATE.head, {
        "cssVersion": cssVer,
        "API_DIR": API_DIR
    });

    return mustache.render(pageTemplate, Object.assign({
        "loggedIn": loggedIn,
        "header": header,
        "head": head,
        "isMod": (userData.userType === "administrator"),
        "userid": userData.userid,
        "homeName": db.band.name,
        "resourceNameCap": toTitleCase(d.resourceName),
        "API_DIR": API_DIR
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

function getAuthData(req, users) {
    var b64auth = (req.headers.authorization || '').split(' ')[1] || '',
        auth = Buffer.from(b64auth, 'base64').toString().split(':'),
        email = auth[0].toLowerCase(),
        userIdFromEmail;

    if (email === 'logout' || email === '') {
        userIdFromEmail = email;
    } else {
        userIdFromEmail = getUserIdByEmail(email, users);
    }

    if (userIdFromEmail) {
        return {"userid": userIdFromEmail, "password": auth[1], "email": email};
    }

    return {"userid": "", "password": "", "email": email};
}
this.getAuthData = getAuthData;

function getAuthUserData(req, users) {
    var userId = getAuthData(req, users).userid;
    var cookies;

    if (!userId) {
        cookies = parseCookie(req.headers.cookie);
        userId = cookies.user;
        if (!userId) {
            return false;
        }
    }
    return Object.assign({"userid": userId}, users[userId]);
}
this.getAuthUserData = getAuthUserData;

var cssVer;
async function loadData() {
    TEMPLATE.head = await readFile(`${__dirname}/head.pht.mustache`, 'utf8');
    TEMPLATE.header = await readFile(`${__dirname}/header.pht.mustache`, 'utf8');
    TEMPLATE.generic = await readFile(`${__dirname}/generic.html.mustache`, 'utf8');

    const fileStats = await fileStat(`${__dirname}/main.css`);
    cssVer = +fileStats.mtime;
}

loadData();
