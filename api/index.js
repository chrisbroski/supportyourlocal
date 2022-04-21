// Standard libs
const http = require('http');
const fs = require("fs").promises;
const url = require('url');

// npm modules
require('dotenv').config();
// const sendmail = require('sendmail')();

// Configuration
const PORT = process.env.PORT || 29170;
const API_DIR = process.env.API_DIR || "/api";
process.env.SUBDIR = API_DIR;
const MAP_KEY = process.env.MAP_KEY || "";
const FAIL_UNTIL_LOCKOUT = process.env.FAIL_UNTIL_LOCKOUT || 10;
const LOCKOUT_DURATION_SECONDS = process.env.LOCKOUT_DURATION_SECONDS || 600000;
const SESSION_TIMEOUT_SECONDS = process.env.SESSION_TIMEOUT_SECONDS || 31622400;

// Custom libs
const main = require('./inc/main.js');
const endure = require('./inc/endure.js');

// Resources
const auth = require('./resource/auth/auth.js');
auth.init(FAIL_UNTIL_LOCKOUT, LOCKOUT_DURATION_SECONDS, SESSION_TIMEOUT_SECONDS);
const gig = require('./resource/gig/gig.js');
const venue = require('./resource/venue/venue.js');
const band = require('./resource/band/band.js');
const song = require('./resource/song/song.js');
const announcement = require('./resource/announcement/announcement.js');
const user = require('./resource/user/user.js');
const site = require('./resource/site/site.js');
const release = require('./resource/release/release.js');
const photo = require('./resource/photo/photo.js');

// Application state
const ASSET = {};
const TEMPLATE = {};
const MANIFEST = {
    "$schema": "https://json.schemastore.org/web-manifest-combined.json",
    "name": "Your Local Band",
    "short_name": "YourLocal",
    "start_url": "/api/",
    "display": "standalone",
    "background_color": "#fff",
    "description": "Band information system",
    "icons": [
        {
        "src": "images/touch/homescreen48.png",
        "sizes": "32x32",
        "type": "image/png"
        }
    ],
    "orientation": "portrait"
};
var db;

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

function getPath(pathname) {
    var path;
    var qs = main.parseQs(pathname, true);
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
}

async function photos(path) {
    var photos = await fs.readdir(path);
    var fileTypes = [".jpg", ".jpeg", ".png"];
    return photos.filter(p => {
        var extension = p.slice(p.lastIndexOf(".")).toLowerCase();
        return (fileTypes.indexOf(extension) > -1);
    });
}

function authenticate(req, rsp, path) {
    var cookies, userid;
    var userData;

    var exceptions = ["login", "password", "forgot-password", "start"];
    if (exceptions.indexOf(path.resource) > -1) {
        return true;
    }

    cookies = main.parseCookie(req.headers.cookie);
    if (!cookies.user) {
        return auth.fail(req, rsp, 'Not logged in', db);
    }
    userid = cookies.user;

    userData = db.user[userid];
    if (!userData) {
        return auth.fail(req, rsp, 'User id not found', db);
    }

    if (!userData.hash) {
        return auth.fail(req, rsp, 'User not able to log in. Please contact your moderator.', db);
    }

    if (main.hash(userData.password + userid, userData.salt) !== cookies.token) {
        return auth.fail(req, rsp, 'Invalid token', db);
    }

    return true;
}

/*
function isFileForm(req) {
    var contentType = req.headers['content-type'];
    if (contentType.length > 18 && contentType.slice(0, 19) === 'multipart/form-data') {
        return true;
    }
    return false;
}*/

function getDelete(req, rsp) {
    var searchParams = url.parse(req.url, true).query;

    if (!db[searchParams.resource][searchParams.id]) {
        return main.notFound(rsp, req.url, 'GET', req, db);
    }

    var deleteData = {
        "resourceName": searchParams.resource,
        "id": searchParams.id,
        "back": req.headers.referer
    };
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, TEMPLATE.delete, deleteData, db));
}

function rspPost(req, rsp, path, body) {
    if (path.path === '/login') {
        return auth.login(req, rsp, body, db);
    }

    if (path.resource === "password") {
        return auth.set(req, rsp, path.id, body, db, endure.save);
    }

    if (path.resource === 'photo') {
        return photo.create(req, rsp, body, db, endure.save);
    }

    if (path.resource === 'gig') {
        return gig.create(req, rsp, body, db, endure.save);
    }

    if (path.resource === 'venue') {
        return venue.create(req, rsp, body, db, endure.save);
    }

    if (path.resource === 'song') {
        return song.create(req, rsp, body, db, endure.save);
    }

    if (path.resource === 'announcement') {
        return announcement.create(req, rsp, body, db, endure.save);
    }

    if (path.resource === 'user') {
        return user.create(req, rsp, body, db, endure.save, API_DIR);
    }

    if (path.resource === 'release') {
        if (path.id) {
            return release.addSong(req, rsp, path.id, body, db, endure.save);
        } else {
            return release.create(req, rsp, body, db, endure.save);
        }
    }

    if (path.resource === 'start') {
        return site.setup(req, rsp, body, db, endure.save, process.env.SETUP_TOKEN);
    }

    return main.notFound(rsp, req.url, 'POST', req, db);
}

function rspPut(req, rsp, path, body) {
    if (path.resource === 'band') {
        return band.update(req, rsp, body, db, endure.save);
    }
    if (path.resource === 'user') {
        return user.update(req, rsp, path.id, body, db, endure.save, API_DIR);
    }
    if (path.resource === 'gig') {
        return gig.update(req, rsp, path.id, body, db, endure.save);
    }
    if (path.resource === 'venue') {
        return venue.update(req, rsp, path.id, body, db, endure.save);
    }
    if (path.resource === 'song') {
        return song.update(req, rsp, path.id, body, db, endure.save);
    }
    if (path.resource === 'announcement') {
        return announcement.update(req, rsp, path.id, body, db, endure.save);
    }
    if (path.resource === 'site') {
        return site.update(req, rsp, body, db, endure.save);
    }
    if (path.resource === 'release') {
        return release.update(req, rsp, path.id, body, db, endure.save);
    }

    if (path.resource === 'password') {
        if (path.id) {
            return auth.update(req, rsp, path.id, body, db, endure.save);
        }
        return;
    }

    return main.notFound(rsp, req.url, 'PUT', req, db);
}

function rspDelete(req, rsp, path) {
    if (path.resource === 'user') {
        return user.remove(req, rsp, path.id, db, endure.save, API_DIR);
    }

    if (path.resource === 'venue') {
        return venue.remove(req, rsp, path.id, db, endure.save);
    }

    if (path.resource === 'song') {
        return song.remove(req, rsp, path.id, db, endure.save);
    }

    if (path.resource === 'announcement') {
        return announcement.remove(req, rsp, path.id, db, endure.save);
    }

    if (path.resource === 'gig') {
        return gig.remove(req, rsp, path.id, db, endure.save);
    }

    if (path.resource === 'release') {
        return release.remove(req, rsp, path.id, db, endure.save);
    }

    if (path.resource === `password`) {
        return auth.reset(req, rsp, path.id, db, endure.save);
    }

    return main.notFound(rsp, req.url, 'DELETE', req, db);
}

function rspPatch(req, rsp, path, body) {
    if (path.resource === 'release') {
        return release.reorderSong(req, rsp, path.id, body, db, endure.save);
    }

    return main.notFound(rsp, req.url, 'PUT', req, db);
}

function rspGet(req, rsp, path) {
    if (path.path === '/favicon.ico') {
        rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'image/png'});
        rsp.end(ASSET.favicon);
        return;
    }
    if (path.path === '/nophoto') {
        rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'image/png'});
        rsp.end(ASSET.noPhoto);
        return;
    }
    if (path.path === '/main.css') {
        rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'text/css'});
        rsp.end(ASSET.mainCss);
        return;
    }
    if (path.path === '/custom.css') {
        return site.getCss(req, rsp, db, true);
    }
    if (path.path === '/header.pht') {
        return site.getHeader(req, rsp, db);
    }
    if (path.pathname === `/ajax-tool`) {
        rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(ASSET.ajaxTool);
        return;
    }
    if (path.path === '/tests') {
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, TEMPLATE.tests, {}, db));
        return;
    }
    if (path.path === '/manifest.json') {
        rsp.writeHead(200, {'Content-Type': 'application/json'});
        rsp.end(JSON.stringify(MANIFEST));
        return;
    }
    if (path.path === '/login') {
        return auth.get(req, rsp, db);
    }
    if (path.path === '/' || path.resource === '') {
        return site.home(req, rsp, db);
    }
    if (path.resource === 'band') {
        return band.get(req, rsp, db);
    }
    if (path.path === '/logout') {
        return auth.logout(req, rsp, db);
    }
    if (path.resource === `data`) {
        rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
        rsp.writeHead(200, {'Content-Type': 'application/json'});
        if (path.id) {
            if (db[path.id]) {
                rsp.end(JSON.stringify(db[path.id]));
            } else {
                rsp.end("{}");
            }

        } else {
            rsp.end(JSON.stringify(db));
        }
        return;
    }
    if (path.resource === 'gig') {
        return gig.get(req, rsp, path.id, db, MAP_KEY);
    }
    if (path.resource === 'venue') {
        return venue.get(req, rsp, path.id, db);
    }
    if (path.resource === 'song') {
        return song.get(req, rsp, path.id, path.qs, db);
    }
    if (path.resource === 'announcement') {
        return announcement.get(req, rsp, path.id, db);
    }
    if (path.resource === 'user') {
        return user.get(req, rsp, path.id, db);
    }
    if (path.resource === 'site') {
        return site.get(req, rsp, db);
    }
    if (path.resource === 'release') {
        return release.get(req, rsp, path.id, db);
    }
    if (path.resource === 'delete') {
        return getDelete(req, rsp, db);
    }
    if (path.resource === "password") {
        return auth.getPassword(req, rsp, path.id, db);
    }
    if (path.resource === "photo") {
        return photo.get(req, rsp, path.id, db);
    }
    // if (path.pathname === `${API_DIR}/forgot-password`) {}

    return main.notFound(rsp, path.pathname, 'GET', req, db);
}

function getMethod(req, body) {
    var method = req.method;
    var methodsAllowed = ['DELETE', 'PUT', 'PATCH'];
    if (method === 'POST') {
        if (methodsAllowed.indexOf(body.method) > -1) {
            method = body.method;
        }
    }
    return method;
}

function getExtension(filename) {
    var ext = "";
    if (filename.indexOf("?") >= 0) {
        filename = filename.slice(0, filename.indexOf("?"));
    }
    if (filename.indexOf(".") >= 0) {
        ext = filename.slice(filename.lastIndexOf("."));
    }
    return ext;
}

function getMatching(string, regex) {
    const matches = string.match(regex);
    if (!matches || matches.length < 2) {
        return null;
    }
    return matches[1];
}

function getBoundary(request) {
    let contentType = request.headers['content-type'];
    const contentTypeArray = contentType.split(';').map(item => item.trim());
    const boundaryPrefix = 'boundary=';
    let boundary = contentTypeArray.find(item => item.startsWith(boundaryPrefix));
    if (!boundary) {
        return null;
    }
    boundary = boundary.slice(boundaryPrefix.length);
    if (boundary) {
        boundary = boundary.trim();
    }
    return boundary;
}

function parseBody(req, body) {
    var contentType = '';
    var parsedBody = {};

    if (req.headers['content-type']) {
        contentType = req.headers['content-type'].split(";")[0];
    }

    if (!body) {
        if (contentType === 'application/json') {
            return parsedBody;
        }
        return "";
    }

    if (contentType === 'application/json') {
        try {
            parsedBody = JSON.parse(body);
        } catch (e) {
            console.log(e);
            console.log(body);
        }
        return parsedBody;
    }

    if (contentType === 'multipart/form-data') {
        const boundary = getBoundary(req);
        const result = {};
        const rawDataArray = body.split(boundary);

        rawDataArray.forEach(item => {
            // Use non-matching groups to exclude part of the result
            const name = getMatching(item, /(?:name=")(.+?)(?:")/);
            if (!name) {
                return;
            }
            const value = getMatching(item, /(?:\r\n\r\n)([\S\s]*)(?:\r\n--$)/);
            if (!value) {
                return;
            }
            const filename = getMatching(item, /(?:filename=")(.*?)(?:")/);
            if (filename) {
                const file = {};
                file[name] = value;
                file.filename = filename;
                const contentType = getMatching(item, /(?:Content-Type:)(.*?)(?:\r\n)/);
                if (contentType) {
                    file.type = getExtension(filename);
                }
                if (!result.files) {
                    result.files = [];
                }
                result.files.push(file);
            } else {
                result[name] = value;
            }
        });
        return result;
    }

    return main.parseQs(body);
}

function allowedBeforeSetup(method, path) {
    if (path.type === "css" || path.type === "ico") {
        return false;
    }
    if (method === "POST" && path.resource === "start") {
        return false;
    }
    return true;
}

function routeMethods(req, rsp, body) {
    var parsedBody = parseBody(req, body);
    var method = getMethod(req, parsedBody);
    var path = getPath(req.url, API_DIR);

    // To trigger a 500 for testing:
    // if (req.method !== 'OPTIONS') {
    //     rsp.writeHead(500, {'Content-Type': 'text/plain'});
    //     rsp.end("Oh, the humanity!");
    //     return;
    // }
    if (method === 'OPTIONS') {
        rsp.writeHead(200, {
            'Content-Type': 'text/plain',
            'Allow': "GET,POST,PUT,DELETE,OPTIONS",
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            "Access-Control-Allow-Headers": "Origin, Content-Type, Accept"
        });
        rsp.end('OK');
        return;
    }

    // redirect for initial setup
    if (allowedBeforeSetup(method, path) && Object.keys(db.user) < 1) {
        return site.start(req, rsp, db, path.qs);
    }

    if (method === 'GET') {
        return rspGet(req, rsp, path);
    }

    if (!authenticate(req, rsp, path)) {
        return;
    }
    if (method === 'POST') {
        return rspPost(req, rsp, path, parsedBody);
    }
    if (method === 'PUT') {
        return rspPut(req, rsp, path, parsedBody);
    }

    if (method === 'DELETE') {
        return rspDelete(req, rsp, path);
    }
    if (method === 'PATCH') {
        return rspPatch(req, rsp, path, parsedBody);
    }

    rsp.writeHead(405, {'Content-Type': 'text/plain'});
    rsp.end('GET, POST, PUT, DELETE, PATCH, and OPTIONS only.');
}

function collectReqBody(req, rsp) {
    var body = [];
    if (req.headers['content-type'] && req.headers['content-type'].split(";")[0] === "multipart/form-data") {
        req.setEncoding('binary');
    } else {
        req.setEncoding('utf8');
    }

    req.on('data', function (chunk) {
        body.push(chunk);
    }).on('end', function () {
        routeMethods(req, rsp, body.join());
    });
}

function init() {
    process.stdin.resume();
    process.on('SIGINT', function () {
        if (db) {
            console.log('Saving data...');
            endure.save(true);
        }
        console.log('Exiting...');
        process.exit();
    });
}

async function loadData() {
    db = await endure.load(`${__dirname}/../data`);
    if (process.env.PHOTO_PATH) {
        db.photos = await photos(process.env.PHOTO_PATH);
    }

    ASSET.favicon = await fs.readFile(`${__dirname}/inc/favicon.png`);
    ASSET.mainCss = await fs.readFile(`${__dirname}/inc/main.css`, 'utf8');
    ASSET.noPhoto = await fs.readFile(`${__dirname}/inc/nophoto.png`);
    ASSET.ajaxTool = await fs.readFile(`${__dirname}/ajax-tool.html`, 'utf8');

    // TEMPLATE.home = await fs.readFile(`${__dirname}/index.html.mustache`, 'utf8');
    // TEMPLATE.homeNoAuth = await fs.readFile(`${__dirname}/index-noauth.html.mustache`, 'utf8');
    TEMPLATE.tests = await fs.readFile(`${__dirname}/tests.html.mustache`, 'utf8');
    TEMPLATE.delete = await fs.readFile(`${__dirname}/inc/delete.html.mustache`, 'utf8');

    MANIFEST.start_url = `${API_DIR}/`;
    MANIFEST.name = `Admin - ${db.band.name} - Your Local Band`;
    MANIFEST.short_name = `Admin ${db.band.name}`;
    MANIFEST.background_color = db.site.color1;
}

function startHTTP() {
    http.createServer(collectReqBody).listen(PORT, function () {
        console.log(`Server started on http://0.0.0.0:${PORT}${API_DIR}`);
    });
}

init();
loadData().then(startHTTP);
