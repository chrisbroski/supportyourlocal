// Standard libs
const http = require('http');
// const https = require('https');
const fs = require("fs");
const qs = require('querystring');
const util = require('util');
const url = require('url');

const readFile = util.promisify(fs.readFile);

// npm modules
require('dotenv').config({path: `${__dirname}/.env`});
// const sendmail = require('sendmail')();

// Configuration
const PORT = process.env.PORT || 29170;
const API_DIR = process.env.API_DIR || "/api";
const MAP_KEY = process.env.MAP_KEY || "";
const FAIL_UNTIL_LOCKOUT = process.env.FAIL_UNTIL_LOCKOUT || 10;
const LOCKOUT_DURATION_SECONDS = process.env.LOCKOUT_DURATION_SECONDS || 600000;
const SESSION_TIMEOUT_SECONDS = process.env.SESSION_TIMEOUT_SECONDS || 31622400;

// Custom libs
const main = require('./inc/main.js');
const resourceData = require('./inc/resource-data.js');

// Resources
const auth = require('./resource/auth/auth.js');
auth.init(FAIL_UNTIL_LOCKOUT, LOCKOUT_DURATION_SECONDS, SESSION_TIMEOUT_SECONDS);
const gig = require('./resource/gig/gig.js');
const venue = require('./resource/venue/venue.js');
const home = require('./resource/home.js');
const song = require('./resource/song/song.js');
const announcement = require('./resource/announcement/announcement.js');
const user = require('./resource/user/user.js');

// Application state
const ASSET = {};
const TEMPLATE = {};
var data;

function authenticate(req, rsp, path) {
    var cookies, userid;
    var userData;

    var exceptions = ["login", "password"];

    // also exclude password set after reset w/ token
    if (exceptions.indexOf(path.resource) > -1) {
        return true;
    }

    cookies = main.parseCookie(req.headers.cookie);
    if (!cookies.user) {
        return auth.fail(req, rsp, 'Not logged in', data, API_DIR);
    }
    userid = cookies.user;

    userData = data.user[userid];
    if (!userData) {
        return auth.fail(req, rsp, 'User id not found', data, API_DIR);
    }

    if (!userData.hash) {
        return auth.fail(req, rsp, 'User not able to log in. Please contact your moderator.', data, API_DIR);
    }

    if (main.hash(userData.password + userid, userData.salt) !== cookies.token) {
        return auth.fail(req, rsp, 'Invalid token', data, API_DIR);
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

function homePage(req, rsp) {
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, TEMPLATE.home, data.home, data, API_DIR));
    return;
}

function getDelete(req, rsp) {
    var searchParams = url.parse(req.url, true).query;

    if (!data[searchParams.resource][searchParams.id]) {
        return main.notFound(rsp, req.url, 'GET', req, data);
    }

    var deleteData = {
        "resourceName": searchParams.resource,
        "id": searchParams.id,
        "back": req.headers.referer
    };
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, TEMPLATE.delete, deleteData, data, API_DIR));
}

function rspPost(req, rsp, path, body) {
    if (path.pathname === `${API_DIR}/login`) {
        return auth.login(req, rsp, body, data, API_DIR);
    }

    if (path.resource === "password") {
        return auth.set(req, rsp, path.id, body, data, resourceData.save, API_DIR);
    }

    // if (path.pathname === `${API_DIR}/forgot-password`) {}

    if (path.resource === `gig`) {
        return gig.create(req, rsp, body, data, resourceData.save, API_DIR);
    }

    if (path.resource === `venue`) {
        return venue.create(req, rsp, body, data, resourceData.save, API_DIR);
    }

    if (path.resource === `song`) {
        return song.create(req, rsp, body, data, resourceData.save, API_DIR);
    }

    if (path.resource === `announcement`) {
        return announcement.create(req, rsp, body, data, resourceData.save, API_DIR);
    }

    if (path.resource === `user`) {
        return user.create(req, rsp, body, data, resourceData.save, API_DIR);
    }

    return main.notFound(rsp, req.url, 'POST', req, data);
}

function rspPut(req, rsp, path, body) {
    if (path.pathname === `${API_DIR}/home`) {
        return home.update(req, rsp, body, data, resourceData.save, API_DIR);
    }
    if (path.resource === `user`) {
        if (path.id) {
            user.update(req, rsp, path.id, body, data, resourceData.save, API_DIR);
        }
        return;
    }
    if (path.resource === `gig`) {
        return gig.update(req, rsp, path.id, body, data, resourceData.save, API_DIR);
    }
    if (path.resource === `venue`) {
        return venue.update(req, rsp, path.id, body, data, resourceData.save, API_DIR);
    }
    if (path.resource === `song`) {
        return song.update(req, rsp, path.id, body, data, resourceData.save, API_DIR);
    }
    if (path.resource === `announcement`) {
        return announcement.update(req, rsp, path.id, body, data, resourceData.save, API_DIR);
    }

    if (path.resource === `password`) {
        if (path.id) {
            return auth.update(req, rsp, path.id, body, data, resourceData.save, API_DIR);
        }
        return;
    }

    return main.notFound(rsp, req.url, 'PUT', req, data);
}

function rspDelete(req, rsp, path) {
    if (path.resource === `user`) {
        return user.remove(req, rsp, path.id, data, resourceData.save, API_DIR);
    }

    if (path.resource === `venue`) {
        return venue.remove(req, rsp, path.id, data, resourceData.save, API_DIR);
    }

    if (path.resource === `song`) {
        return song.remove(req, rsp, path.id, data, resourceData.save, API_DIR);
    }

    if (path.resource === `announcement`) {
        return announcement.remove(req, rsp, path.id, data, resourceData.save, API_DIR);
    }

    if (path.resource === `gig`) {
        return gig.remove(req, rsp, path.id, data, resourceData.save, API_DIR);
    }

    if (path.resource === `password`) {
        return auth.reset(req, rsp, path.id, data, resourceData.save, API_DIR);
    }

    return main.notFound(rsp, req.url, 'DELETE', req, data);
}

function rspGet(req, rsp, path) {
    var cookies;

    if (path.pathname === `${API_DIR}/favicon.ico`) {
        rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'image/png'});
        rsp.end(ASSET.favicon);
        return;
    }
    if (path.pathname === `${API_DIR}/main.css`) {
        rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'text/css'});
        rsp.end(ASSET.mainCss);
        return;
    }
    if (path.pathname === `${API_DIR}/custom.css`) {
        return home.getCss(req, rsp, data, true);
    }
    if (path.pathname === `${API_DIR}/header.pht`) {
        return home.getHeader(req, rsp, data);
    }
    if (path.pathname === `/ajax-tool`) {
        rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(ASSET.ajaxTool);
        return;
    }
    if (path.pathname === `${API_DIR}/tests`) {
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, TEMPLATE.tests, {}, data, API_DIR));
        return;
    }
    if (path.pathname === `${API_DIR}/login`) {
        return auth.get(req, rsp, data, API_DIR);
    }
    if (path.pathname === `${API_DIR}/`) {
        return homePage(req, rsp);
    }
    if (path.pathname === `${API_DIR}/home` || path.pathname === `${API_DIR}/home/`) {
        return home.get(req, rsp, data, API_DIR);
    }
    if (path.pathname === `${API_DIR}/logout`) {
        cookies = main.parseCookie(req.headers.cookie);
        rsp.setHeader('Set-Cookie', [
            `token=; Path=/; SameSite=Strict;`, // make secure later
            `user=; Path=/; SameSite=Strict;` // make secure later
        ]);
        rsp.writeHead(303, {'Content-Type': 'text/html', "Location": `${API_DIR}/home`});
        rsp.end(main.renderPage(req, null, {"msg": ["Logged out"], "title": `Logged out`, "link": `${API_DIR}/home/`}, data, API_DIR));
        return;
    }
    if (path.resource === `data`) {
        rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
        rsp.writeHead(200, {'Content-Type': 'application/json'});
        if (path.id) {
            if (data[path.id]) {
                rsp.end(JSON.stringify(data[path.id]));
            } else {
                rsp.end("{}");
            }

        } else {
            rsp.end(JSON.stringify(data));
        }
        return;
    }
    if (path.resource === `gig`) {
        // rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
        return gig.get(req, rsp, path.id, data, API_DIR, MAP_KEY);
    }
    if (path.resource === `venue`) {
        return venue.get(req, rsp, path.id, data, API_DIR);
    }
    if (path.resource === `song`) {
        return song.get(req, rsp, path.id, data, API_DIR);
    }
    if (path.resource === `announcement`) {
        return announcement.get(req, rsp, path.id, data, API_DIR);
    }
    if (path.resource === `user`) {
        return user.get(req, rsp, path.id, data, API_DIR);
    }
    if (path.resource === `delete`) {
        return getDelete(req, rsp, data, API_DIR);
    }
    if (path.resource === "password") {
        return auth.getPassword(req, rsp, path.id, data, API_DIR);
    }
    // if (path.pathname === `${API_DIR}/forgot-password`) {}

    return main.notFound(rsp, path.pathname, 'GET', req, data);
}

function getMethod(req, body) {
    var method = req.method;
    if (req.method === 'POST' || req.method === 'PUT') {
        if (body.method && (body.method === 'PUT' || body.method === 'DELETE')) {
            method = body.method;
        }
    }
    return method;
}

function parseBody(req, body) {
    var contentType = '';
    var parsedBody = {};
    if (!body) {
        return parsedBody;
    }
    if (req.headers['content-type']) {
        contentType = req.headers['content-type'].split(";")[0];
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

    if (contentType === 'text/csv') {
        return main.parseCsv(body);
    }

    return qs.parse(body);
}

function routeMethods(req, rsp, body) {
    var parsedBody = parseBody(req, body);
    var method = getMethod(req, parsedBody);
    var path = main.getPath(req.url, API_DIR);

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

    rsp.writeHead(405, {'Content-Type': 'text/plain'});
    rsp.end('GET, POST, PUT, DELETE, and OPTIONS only.');
}

function collectReqBody(req, rsp) {
    var body = [];

    req.on('data', function (chunk) {
        body.push(chunk);
    }).on('end', function () {
        body = Buffer.concat(body).toString();
        routeMethods(req, rsp, body);
    });
}

function init() {
    process.stdin.resume();
    process.on('SIGINT', function () {
        if (data) {
            console.log('Saving data...');
            resourceData.save(true);
        }
        console.log('Exiting...');
        process.exit();
    });
}

async function loadData() {
    data = await resourceData.load();

    ASSET.favicon = await readFile(`${__dirname}/inc/favicon.png`);
    ASSET.mainCss = await readFile(`${__dirname}/inc/main.css`, 'utf8');
    ASSET.ajaxTool = await readFile(`${__dirname}/ajax-tool.html`, 'utf8');

    TEMPLATE.home = await readFile(`${__dirname}/index.html.mustache`, 'utf8');
    TEMPLATE.tests = await readFile(`${__dirname}/tests.html.mustache`, 'utf8');
    TEMPLATE.delete = await readFile(`${__dirname}/inc/delete.html.mustache`, 'utf8');
}

function startHTTP() {
    http.createServer(collectReqBody).listen(PORT, function () {
        console.log(`Server started on http://0.0.0.0:${PORT}${API_DIR}`);
    });
}

init();
loadData().then(startHTTP);
