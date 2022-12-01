// Standard libs
const http = require('http');
const fs = require("fs").promises;

// npm modules
require('dotenv').config();
// const sendmail = require('sendmail')();

// Configuration
const PORT = process.env.PORT || 29170;
process.env.SUBDIR = process.env.API_DIR || "/api";
const MAP_KEY = process.env.MAP_KEY || "";
process.env.PHOTO_STORAGE_LIMIT = process.env.PHOTO_STORAGE_LIMIT || 50000000;
process.env.PHOTO_SIZE_LIMIT = process.env.PHOTO_SIZE_LIMIT || 2000;
process.env.PHOTO_WEB_SIZE = process.env.PHOTO_WEB_SIZE || 1200;

// Custom libs
const main = require('./inc/main.js');
const endure = require('./inc/endure.js');

// Resources
const auth = require('./resource/auth/auth.js');
const gig = require('./resource/gig/gig.js');
const venue = require('./resource/venue/venue.js');
const band = require('./resource/band/band.js');
const support = require('./resource/support/support.js');
const song = require('./resource/song/song.js');
const announcement = require('./resource/announcement/announcement.js');
const user = require('./resource/user/user.js');
const site = require('./resource/site/site.js');
const style = require('./resource/style/style.js');
const release = require('./resource/release/release.js');
const photo = require('./resource/photo/photo.js');
const font = require('./resource/font/font.js');
const version = require('./resource/version/version.js');
const head = require('./resource/head/head.js');

// Application state
const ASSET = {};
const TEMPLATE = {};
const MANIFEST = {
    "$schema": "https://json.schemastore.org/web-manifest-combined.json",
    "name": "Your Local Band",
    "short_name": "YourLocal",
    "start_url": process.env.SUBDIR,
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
var cssMainVer = "";
global.photoStorageUsed = 0;

function getDelete(req, rsp) {
    var searchParams = main.parseQs(req.url, true);

    if (!db[searchParams.resource][searchParams.id]) {
        if (Array.isArray(db[searchParams.resource])) {
            if (db[searchParams.resource].indexOf(searchParams.id) === -1) {
                return main.notFound(rsp, req.url, 'GET', req, db);
            }
        } else {
            return main.notFound(rsp, req.url, 'GET', req, db);
        }
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

    if (path.resource === 'font') {
        return font.create(req, rsp, body, db, endure.save);
    }

    if (path.resource === 'gig') {
        return gig.create(req, rsp, body, db, endure.save);
    }

    if (path.resource === 'venue') {
        return venue.create(req, rsp, body, db, endure.save);
    }

    if (path.resource === 'song') {
        if (path.id) {
            return song.addMedia(req, rsp, path.id, body, db, endure.save);
        } else {
            return song.create(req, rsp, body, db, endure.save);
        }
    }

    if (path.resource === 'announcement') {
        return announcement.create(req, rsp, body, db, endure.save);
    }

    if (path.resource === 'user') {
        return user.create(req, rsp, body, db, endure.save);
    }

    if (path.resource === 'release') {
        if (path.id) {
            return release.addItem(req, rsp, path.id, body, db, endure.save);
        } else {
            return release.create(req, rsp, body, db, endure.save);
        }
    }

    if (path.resource === 'style') {
        return style.addColorOrFont(req, rsp, body, db, endure.save);
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
    if (path.resource === 'support') {
        return support.update(req, rsp, body, db, endure.save);
    }
    if (path.resource === 'user') {
        return user.update(req, rsp, path.id, body, db, endure.save);
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
    if (path.resource === 'style') {
        return style.update(req, rsp, body, db, endure.save);
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
        return user.remove(req, rsp, path.id, db, endure.save);
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

    if (path.resource === 'photo') {
        return photo.remove(req, rsp, path.id, db, endure.save);
    }

    if (path.resource === 'font') {
        return font.remove(req, rsp, path.id, db, endure.save);
    }

    if (path.resource === `password`) {
        return auth.reset(req, rsp, path.id, db, endure.save);
    }

    return main.notFound(rsp, req.url, 'DELETE', req, db);
}

function rspPatch(req, rsp, path, body) {
    if (path.resource === 'release') {
        return release.reorderItem(req, rsp, path.id, body, db, endure.save);
    }
    if (path.resource === 'song') {
        return song.reorderMedia(req, rsp, path.id, body, db, endure.save);
    }
    if (path.resource === 'style') {
        return style.reorderColorOrFont(req, rsp, body, db, endure.save);
    }

    return main.notFound(rsp, req.url, 'PATCH', req, db);
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
    if (path.resource === 'support') {
        return support.get(req, rsp, db);
    }
    if (path.path === '/logout') {
        return auth.logout(req, rsp, db);
    }
    if (path.resource === 'data') {
        rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
        if (path.qs.key === process.env.ADMIN_TOKEN) {
            if (path.id) {
                if (db[path.id]) {
                    return main.returnJson(rsp, db[path.id]);
                } else {
                    rsp.writeHead(404, {'Content-Type': 'application/json'});
                    return rsp.end('');
                }
            } else {
                return main.returnJson(rsp, db);
            }
        }
        rsp.writeHead(400, {'Content-Type': 'application/json'});
        return rsp.end('Invalid API key');
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
    if (path.resource === 'style') {
        return style.get(req, rsp, db);
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
    if (path.resource === "font") {
        return font.get(req, rsp, path.id, db);
    }
    if (path.resource === "meta") {
        return head.get(req, rsp, db, path.qs, cssMainVer);
    }
    if (path.resource === "version") {
        return version.get(req, rsp, db);
    }

    // if (path.pathname === `${process.env.SUBDIR}/forgot-password`) {}

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
    var path = main.getPath(req.url);

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

    if (!auth.authenticate(req, rsp, db, path)) {
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
    });
    req.on('end', function () {
        routeMethods(req, rsp, body.join(""));
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

function migrate() {
    // migrate data, if needed
    if (!db.band.music) {
        db.band.music = {};
    }
}

var cssStat;
async function loadData() {
    db = await endure.load(`${__dirname}/../data`);

    migrate();
    if (process.env.CSS_FRONT) {
        cssStat = await fs.stat(process.env.CSS_FRONT);
    }

    ASSET.favicon = await fs.readFile(`${__dirname}/inc/favicon.png`);
    ASSET.mainCss = await fs.readFile(`${__dirname}/inc/main.css`, 'utf8');
    ASSET.noPhoto = await fs.readFile(`${__dirname}/inc/nophoto.png`);
    ASSET.ajaxTool = await fs.readFile(`${__dirname}/ajax-tool.html`, 'utf8');

    TEMPLATE.tests = await fs.readFile(`${__dirname}/tests.html.mustache`, 'utf8');
    TEMPLATE.delete = await fs.readFile(`${__dirname}/inc/delete.html.mustache`, 'utf8');

    MANIFEST.start_url = `${process.env.SUBDIR}/`;
    MANIFEST.name = `Admin - ${db.band.name} - Your Local Band`;
    MANIFEST.short_name = `Admin ${db.band.name}`;
    MANIFEST.background_color = db.site.color1;
}

function startHTTP() {
    http.createServer(collectReqBody).listen(PORT, function () {
        console.log(`Server started on http://0.0.0.0:${PORT}${process.env.SUBDIR}`);
    });
    global.photoStorageUsed = Object.values(db.photo).reduce((total, b) => {
        return total + b.size;
    }, 0);
    if (cssStat) {
        cssMainVer = +(new Date(cssStat.mtime));
    }
}

init();
loadData().then(startHTTP);
