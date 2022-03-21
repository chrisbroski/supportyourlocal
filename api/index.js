// Standard libs
const http = require('http');
// const https = require('https');
const fs = require("fs");
const qs = require('querystring');
const util = require('util');
const url = require('url');
const crypto = require('crypto');

const readFile = util.promisify(fs.readFile);

// npm modules
require('dotenv').config({path: `${__dirname}/.env`});
// const sendmail = require('sendmail')();

// Custom libs
const main = require('./inc/main.js');
const resourceData = require('./inc/resource-data.js');

// Resources
const gig = require('./resource/gig/gig.js');
const venue = require('./resource/venue/venue.js');
const home = require('./resource/home.js');
const song = require('./resource/song/song.js');
const announcement = require('./resource/announcement/announcement.js');
const user = require('./resource/user.js');

// Configuration
var PORT = 29170;
if (process.env.PORT) {
    PORT = process.env.PORT;
}
var API_DIR = "/api";
if (process.env.API_DIR) {
    API_DIR = process.env.API_DIR;
}

const MAP_KEY = process.env.MAP_KEY;
const ASSET = {};
const TEMPLATE = {};
const LOGIN_FAIL_MAX = 10;
const LOGIN_FAIL_RESET_DURATION = 600000;

// Global state
var data;
var failedLogins = {};
// var log;
var sessionTimeout = 31622400;

function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 1, 63, 'sha512').toString('base64');
}

function updatePassword(id, req, rsp, formData) {
    // var cookies;

    // if (isInvalid(invalidPassword, rsp, Object.assign({"id": id}, formData), data)) {
    //     return;
    // }
    if (!formData.passwordNew) {
        rsp.writeHead(400, {'Content-Type': 'text/plain'});
        rsp.end('Password required.');
        return;
    }
    // cookies = main.parseCookie(req.headers.cookie);

    resourceData.setPassword(id, formData);

    // if same user, re-authenticate
    // cookies = main.parseCookie(req.headers.cookie);
    // updateAuth(cookies.session, id, rsp);

    rsp.writeHead(200, {'Content-Type': 'text/plain'});
    rsp.end('Password set.');
    return;
}

function cleanFailedLogins() {
    var now = (new Date()).getTime();

    Object.keys(failedLogins).forEach(function (login) {
        failedLogins[login] = failedLogins[login].filter(function (failedAt) {
            return (failedAt > now - LOGIN_FAIL_RESET_DURATION);
        });
    });
}

function addFailedLogin(username) {
    if (!failedLogins[username]) {
        failedLogins[username] = [];
    }
    failedLogins[username].push((new Date()).getTime());
}

function isUserLockedOut(username) {
    cleanFailedLogins();
    if (!failedLogins[username]) {
        return false;
    }
    if (failedLogins[username].length >= LOGIN_FAIL_MAX) {
        return true;
    }
    return false;
}

function authFail(req, rsp, msg) {
    rsp.setHeader('Set-Cookie', [
        `token=; Path=/; SameSite=Strict; Secure`,
        `user=; Path=/; SameSite=Strict; Secure`
    ]);

    rsp.writeHead(403, {'Content-Type': 'text/plain'});
    rsp.end(msg);
    return false;
}

function login(req, rsp, body) {
    var lockoutDuration;
    var userId = main.getUserIdByEmail(body.email, data.user);

    var userData = data.user[userId];

    if (!body.email) {
        return authFail(req, rsp, `User email required.`);
    }

    if (!body.password) {
        return authFail(req, rsp, `Password required.`);
    }

    if (!userId) {
        return authFail(req, rsp, `Account for ${body.email} not found.`, 400);
    }

    if (!userData.hash) {
        return authFail(req, rsp, 'User not able to log in. Please contact your moderator.');
    }

    if (isUserLockedOut(userId)) {
        lockoutDuration = Math.round(LOGIN_FAIL_RESET_DURATION / 60000);
        rsp.writeHead(403, {'Content-Type': 'text/plain'});
        rsp.end(`User locked out from too many failed attempts.
        Try again in ${lockoutDuration} minutes.`);
        return false;
    }

    if (userData.hash === hashPassword(body.password, userData.salt)) {
        var secure = " Secure";
        secure = ""; // at least until I get https on everything
        if (process.env.QA) {
            secure = "";
        }
        rsp.setHeader('Set-Cookie', [
            `token=${userData.hash}; Path=/; SameSite=Strict; Max-Age=${sessionTimeout};${secure}`,
            `user=${userId}; Path=/; SameSite=Strict; Max-Age=${sessionTimeout};${secure}`
        ]);
        rsp.writeHead(200, {'Content-Type': 'text/plain'});
        rsp.end(`Logged in`);
        return true;
    }

    // Failed login
    addFailedLogin(userId);
    authFail(req, rsp, 'Bad username and/or password');
    return false;
}

function authenticate(req, rsp) {
    var cookies, userid;
    var path = getPath(req.url);

    if (path.pathname === `${API_DIR}/login`) {
        return true;
    }

    cookies = main.parseCookie(req.headers.cookie);
    if (!cookies.user) {
        return authFail(req, rsp, 'Not logged in');
    }
    userid = cookies.user;

    if (!data.user[userid]) {
        return authFail(req, rsp, 'User id not found');
    }

    if (!data.user[userid].hash) {
        return authFail(req, rsp, 'User not able to log in. Please contact your moderator.');
    }

    if (data.user[userid].hash !== cookies.token) {
        return authFail(req, rsp, 'Invalid token');
    }

    return true;
}

function checkEmailExists(email, users) {
    return Object.keys(users).some(function (id) {
        return users[id].email === email;
    });
}

function isUserInvalid(registrant, data) {
    var msg = [];
    var userMsg = "";

    if (registrant.index) {
        userMsg = ` as user #${registrant.index + 1}`;
    }

    if (!registrant.email) {
        msg.push(`Email is required${userMsg}.`);
    }

    if (checkEmailExists(registrant.email, data.user)) {
        msg.push(`Email ${registrant.email} already registered${userMsg}.`);
    }

    return msg;
}

function createUser(req, rsp, formData) {
    var count = 0;
    var arrayMsg = [];

    if (!Array.isArray(formData)) {
        formData = [formData];
    }

    if (formData.length < 2) {
        if (isInvalid(invalidCreateUser, rsp, formData[0], data)) {
            return;
        }

        var userid = resourceData.addUser(formData[0]);
        rsp.writeHead(201, {'Content-Type': 'text/plain', "Location": `${API_DIR}/user/${userid[0]}`});
        rsp.end(`User ${userid[0]} created.`);
        return;
    } else {
        formData.forEach(function (registrant, index) {
            var dataWithIndex = Object.assign({"index": index}, registrant);
            var msg = isUserInvalid(dataWithIndex, data);

            if (msg.length > 0) {
                console.log('msg.length > 0');
                arrayMsg = arrayMsg.concat(msg);
            } else {
                console.log('no error msg');
                resourceData.addUser(registrant);
                count += 1;
            }
        });

        rsp.writeHead(201, {'Content-Type': 'text/plain'});
        rsp.end(`${arrayMsg.join("\n")}

${count} Users created.`);
    }

    return;
}

function updateUser(id, rsp, formData, moderator) {
    formData = Object.assign({"id": id}, formData);
    if (isInvalid(invalidUpdateUser, rsp, formData, data)) {
        return;
    }

    // valid email, password strength, max size for fields
    resourceData.updateUser(id, formData, moderator);

    rsp.writeHead(200, {'Content-Type': 'text/plain'});
    rsp.end(`User ${id} updated.`);
    return;
}

/*function resetPassword(rsp, path, body) {
    var formData = Object.assign({"userid": path.id}, body);
    if (isInvalid('resetPassword', rsp, formData, data.user[path.id])) {
        return;
    }

    resourceData.setPassword(path.id, body);
    rsp.writeHead(200, {'Content-Type': 'text/plain'});
    rsp.end(`Password reset for user ${data.user[path.id].email}.`);
    return;
}

function isFileForm(req) {
    var contentType = req.headers['content-type'];
    if (contentType.length > 18 && contentType.slice(0, 19) === 'multipart/form-data') {
        return true;
    }
    return false;
}*/

function removeQs(fullUrl) {
    if (!fullUrl) {
        return '';
    }
    if (fullUrl.indexOf('?') === -1) {
        return fullUrl;
    }
    return fullUrl.slice(0, fullUrl.indexOf('?'));
}

function getPath(pathname) {
    var path;
    var id;
    var ids = [];

    pathname = removeQs(pathname);
    path = pathname.slice(0, pathname.indexOf("/", 5));
    if (!path) {
        return {"path": pathname};
    }
    id = pathname.slice(pathname.indexOf("/", 5) + 1);
    ids = id.split("/");
    ids = ids.map(function (i) {
        return decodeURIComponent(i);
    });
    return {
        "path": decodeURIComponent(path),
        "id": decodeURIComponent(id),
        "pathname": decodeURIComponent(pathname),
        "ids": ids
    };
}

function homePage(req, rsp) {
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, TEMPLATE.home, data.home, data, API_DIR));
    return;
}

function isMod(req) {
    var userData = main.getAuthUserData(req, data.user);
    if (!userData) {
        return false;
    }
    return (userData.userType === "administrator");
}

function invalidCreateUser(registrant, data) {
    var msg = [];
    var userMsg = "";

    if (registrant.index) {
        userMsg = ` for user ${registrant.index}`;
    }

    if (!registrant.email) {
        msg.push(`Email is required${userMsg}.`);
    }

    if (checkEmailExists(registrant.email, data.user)) {
        msg.push(`Email ${registrant.email} already registered${userMsg}.`);
    }

    return msg;
}

/*function invalidEmail(body, data) {
    var msg = [];

    if (!body.email) {
        msg.push(`Email is required.`);
    }

    if (!body.locationId) {
        msg.push(`Location is required.`);
    }

    return msg;
}

function invalidPassword(registrant, data) {
    var msg = [];

    if (!registrant.email) {
        msg.push(`Password is required.`);
    }

    return msg;
}*/

function invalidUpdateUser(registrant, data) {
    var msg = [];
    var userMsg = "";

    if (registrant.index) {
        userMsg = ` for user ${registrant.index}`;
    }

    if (!registrant.email) {
        msg.push(`Email is required${userMsg}.`);
    }

    if (data.user[registrant.id].email !== registrant.email && checkEmailExists(registrant.email, data.user)) {
        msg.push(`Email ${registrant.email} already registered${userMsg}.`);
    }

    return msg;
}

function isInvalid(func, rsp, body, data) {
    var msg = func(body, data);
    if (msg.length) {
        rsp.writeHead(400, {'Content-Type': 'text/plain'});
        rsp.end(msg.join("\n"));
        return true;
    }
    return false;
}

function getDelete(req, rsp) {
    var searchParams = url.parse(req.url, true).query;

    if (!data[searchParams.resource][searchParams.id]) {
        return main.notFound(rsp, req.url, 'GET', req, data);
    }

    // get querystring resource and id
    // check that it exists
    var deleteData = {
        "resourceName": searchParams.resource,
        "id": searchParams.id,
        "back": req.headers.referer
    };
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, TEMPLATE.delete, deleteData, data, API_DIR));
}

function rspPost(req, rsp, body) {
    var path = getPath(req.url);
    var userid, token;
    var returnUrl;

    if (path.pathname === `${API_DIR}/login`) {
        return login(req, rsp, body);
        // redirect to index, or possibly where they were trying to go
    }

    if (path.pathname === `${API_DIR}/password`) {
        var authData = main.getAuthUserData(req, data.user);
        updatePassword(authData.userid, req, rsp, body);
        return;
    }

    if (path.pathname === `${API_DIR}/reset-password`) {
        userid = body.userid;
        if (!userid) {
            rsp.writeHead(400, {'Content-Type': 'text/plain'});
            rsp.end(`Userid is required.`);
            return;
        }

        if (!data.user[userid]) {
            rsp.writeHead(404, {'Content-Type': 'text/plain'});
            rsp.end(`User not found.`);
            return;
        }

        token = body.token;
        if (!token) {
            rsp.writeHead(400, {'Content-Type': 'text/plain'});
            rsp.end(`Token is required.`);
            return;
        }

        if (data.user[userid].token !== token) {
            rsp.writeHead(404, {'Content-Type': 'text/plain'});
            rsp.end(`Invalid token.`);
            return;
        }

        if (!body.password) {
            rsp.writeHead(404, {'Content-Type': 'text/plain'});
            rsp.end(`Password required.`);
            return;
        }

        resourceData.completePasswordReset(userid, body.password);

        rsp.writeHead(200, {'Content-Type': 'text/plain'});
        rsp.end(`Password updated`);
        return;
    }

    if (path.pathname === `${API_DIR}/set-password`) {
        if (!body.email) {
            rsp.writeHead(400, {'Content-Type': 'text/plain'});
            rsp.end(`Email is required.`);
            return;
        }
        if (!body.passwordNew) {
            rsp.writeHead(400, {'Content-Type': 'text/plain'});
            rsp.end(`Password is required.`);
            return;
        }
        userid = main.getUserIdByEmail(body.email, data.user);
        if (!userid) {
            if (req.headers.accept === 'application/json') {
                rsp.writeHead(404, {'Content-Type': 'text/plain'});
                rsp.end(`User ${body.email} not found.`);
            } else {
                rsp.writeHead(303, {"Location": `https://${req.headers.host}${API_DIR}/password/?msg=Email%20${body.email}%20not%20found.`});
                rsp.end();
            }
            return;
        }
        if (!data.user[userid].token) {
            if (req.headers.accept === 'application/json') {
                rsp.writeHead(400, {'Content-Type': 'text/plain'});
                rsp.end(`Password for ${body.email} has already been set.`);
            } else {
                rsp.writeHead(303, {
                    "Location": `https://${req.headers.host}${API_DIR}/password/?msg=Password for ${body.email} has already been set.`
                });
                rsp.end();
            }
            return;
        }
        return updatePassword(userid, req, rsp, body);
    }

    if (path.pathname === `${API_DIR}/forgot-password`) {
        if (!body.email) {
            rsp.writeHead(400, {'Content-Type': 'text/plain'});
            rsp.end('Email is required.');
            return;
        }
        userid = main.getUserIdByEmail(body.email, data.user);
        if (!userid) {
            if (req.headers.accept === 'application/json') {
                rsp.writeHead(404, {'Content-Type': 'text/plain'});
                rsp.end('Email not found.');
            } else {
                rsp.writeHead(303, {"Location": `https://${req.headers.host}/auth-forgot?msg=Email%20${body.email}%20not%20found.`});
                rsp.end();
            }
            return;
        }

        token = resourceData.resetPassword(userid);
        returnUrl = `https://${req.headers.host}/auth-reset?userid=${userid}&token=${token}`;
        // sendResetEmail(returnUrl, data.user[userid].email);

        if (req.headers.accept === 'application/json') {
            rsp.writeHead(200, {'Content-Type': 'application/json'}).end(JSON.stringify({
                "returnUrl": returnUrl
            }));
        } else {
            rsp.writeHead(303, {"Location": `https://${req.headers.host}/`});
        }
        rsp.end();
        return;
    }

    if (path.path === `${API_DIR}/gig`) {
        return gig.create(req, rsp, body, data, resourceData.save, API_DIR);
    }

    if (path.path === `${API_DIR}/venue`) {
        return venue.create(req, rsp, body, data, resourceData.save, API_DIR);
    }

    if (path.path === `${API_DIR}/song`) {
        return song.create(req, rsp, body, data, resourceData.save, API_DIR);
    }

    if (path.path === `${API_DIR}/announcement`) {
        return announcement.create(req, rsp, body, data, resourceData.save, API_DIR);
    }

    if (path.path === `${API_DIR}/user`) {
        return createUser(req, rsp, body, data, resourceData.save);
    }

    return main.notFound(rsp, req.url, 'POST', req, data);
}

function rspPut(req, rsp, body) {
    var path = getPath(req.url);
    var moderator = isMod(req);
    var userid;
    // var querystring = url.parse(req.url, true).query;

    if (path.pathname === `${API_DIR}/home`) {
        return home.update(req, rsp, body, data, resourceData.save, API_DIR);
    }
    if (path.path === `${API_DIR}/user`) {
        if (path.id) {
            updateUser(path.id, rsp, body, moderator);
        }
        return;
    }
    if (path.path === `${API_DIR}/gig`) {
        return gig.update(req, rsp, path.id, body, data, resourceData.save, API_DIR);
    }
    if (path.path === `${API_DIR}/venue`) {
        return venue.update(req, rsp, path.id, body, data, resourceData.save, API_DIR);
    }
    if (path.path === `${API_DIR}/song`) {
        return song.update(req, rsp, path.id, body, data, resourceData.save, API_DIR);
    }
    if (path.path === `${API_DIR}/announcement`) {
        return announcement.update(req, rsp, path.id, body, data, resourceData.save, API_DIR);
    }

    if (path.path === `${API_DIR}/password`) {
        if (path.id) {
            // do validation checks
            return updatePassword(path.id, req, rsp, body);
        }
        return;
    }
    if (path.path === `${API_DIR}/password`) {
        userid = main.getUserIdByEmail(body.email, data.user);
        if (userid) {
            resourceData.setPassword(userid, body);
            if (req.headers.accept === 'application/json') {
                rsp.writeHead(200, "Success!");
            } else {
                rsp.writeHead(303, {"Location": `https://${req.headers.host}/`});
            }
            rsp.end();
        }
        return;
    }

    return main.notFound(rsp, req.url, 'PUT', req, data);
}

function rspDelete(req, rsp) {
    var path = getPath(req.url);
    // var authData = main.getAuthUserData(req, data.user);
    var token;
    var returnUrl;

    // if (!((authData.moderator || isMod(req)) || (path.path === `${API_DIR}/user` && path.id === authData.userid))) {
    //     rsp.writeHead(403, {'Content-Type': 'text/plain'});
    //     rsp.end('Requires moderator privileges.');
    //     return;
    // }

    if (path.path === `${API_DIR}/user`) {
        if (!data.user[path.id]) {
            rsp.writeHead(404, {'Content-Type': 'text/plain'});
            rsp.end(`Invalid User DELETE URL: ${req.url}`);
            return;
        }
        resourceData.deleteUser(path.id);

        rsp.writeHead(200, {'Content-Type': 'text/plain'});
        rsp.end(`User id '${path.id}' deleted.`);
        return;
    }

    if (path.path === `${API_DIR}/venue`) {
        return venue.remove(req, rsp, path.id, data, resourceData.save, API_DIR);
    }

    if (path.path === `${API_DIR}/song`) {
        return song.remove(req, rsp, path.id, data, resourceData.save, API_DIR);
    }

    if (path.path === `${API_DIR}/announcement`) {
        return announcement.remove(req, rsp, path.id, data, resourceData.save, API_DIR);
    }

    if (path.path === `${API_DIR}/gig`) {
        return gig.remove(req, rsp, path.id, data, resourceData.save, API_DIR);
    }

    if (path.path === `${API_DIR}/password`) {
        if (!isMod(req)) {
            rsp.writeHead(403, {'Content-Type': 'text/plain'});
            rsp.end('Only moderators can reset passwords.');
            return;
        }

        token = resourceData.resetPassword(path.id);

        returnUrl = `https://${req.headers.host}${API_DIR}/password/${path.id}?token=${token}`;
        // sendResetEmail(returnUrl, rsp, data.user[path.id].email, 'reset-password');
        rsp.writeHead(200, {'Content-Type': 'text/plain'}).end(`Complete reset at: ${returnUrl}`);
        return;
    }

    return main.notFound(rsp, req.url, 'DELETE', req, data);
}

function rspGet(req, rsp) {
    var path = getPath(req.url);
    var authUserData;
    // var querystring = url.parse(req.url, true).query;
    var cookies;

    if (path.pathname === `${API_DIR}/favicon.ico`) {
        rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'image/png'});
        rsp.end(ASSET.favicon);
        return;
    } else if (path.pathname === `${API_DIR}/main.css`) {
        rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'text/css'});
        rsp.end(ASSET.mainCss);
        return;
    } else if (path.pathname === `${API_DIR}/custom.css`) {
        return home.getCss(req, rsp, data, true);
    } else if (path.pathname === `${API_DIR}/header.pht`) {
        return home.getHeader(req, rsp, data);
    } else if (path.pathname === `/ajax-tool`) {
        rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(ASSET.ajaxTool);
        return;
    } else if (path.pathname === `${API_DIR}/tests`) {
        // rsp.setHeader('Cache-Control', 'max-age=31536000,public');
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        // rsp.end(ASSET.ajaxTool);
        rsp.end(main.renderPage(req, TEMPLATE.tests, {}, data, API_DIR));
        return;
    //TEMPLATE.tests
    } else if (path.pathname === `${API_DIR}/login`) {
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, TEMPLATE.login, {}, data, API_DIR));
        return;
    } else if (path.pathname === `${API_DIR}/`) {
        return homePage(req, rsp);
    } else if (path.pathname === `${API_DIR}/home` || path.pathname === `${API_DIR}/home/`) {
        return home.get(req, rsp, data, API_DIR);
    } else if (path.pathname === `${API_DIR}/logout`) {
        cookies = main.parseCookie(req.headers.cookie);
        // updateSessionToken(cookies.session, cookies.user, rsp, true);
        // rsp.writeHead(403, {'WWW-Authenticate': 'Basic', 'Content-Type': 'text/plain'});
        rsp.setHeader('Set-Cookie', [
            `token=; Path=/; SameSite=Strict;`, // make secure later
            `user=; Path=/; SameSite=Strict;` // make secure later
        ]);
        rsp.writeHead(200, {'Content-Type': 'text/plain'});
        rsp.end('Logged out');
        return;
    } else if (path.path === `${API_DIR}/data`) {
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
    } else if (path.path === `${API_DIR}/gig`) {
        // rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
        return gig.get(req, rsp, path.id, data, API_DIR, MAP_KEY);
    } else if (path.path === `${API_DIR}/venue`) {
        return venue.get(req, rsp, path.id, data, API_DIR);
    } else if (path.path === `${API_DIR}/song`) {
        return song.get(req, rsp, path.id, data, API_DIR);
    } else if (path.path === `${API_DIR}/announcement`) {
        return announcement.get(req, rsp, path.id, data, API_DIR);
    } else if (path.path === `${API_DIR}/user`) {
        return user.get(req, rsp, path.id, data, API_DIR);
    } else if (path.pathname === `${API_DIR}/delete`) {
        return getDelete(req, rsp, data, API_DIR);
    } else if (path.pathname === `${API_DIR}/password`) {
        // console.log("/password");
        if (!authenticate(req, rsp)) {
            return;
        }
        // if authenticated, return 400
        // if (authenticate(req, rsp, true)) {
        //     rsp.writeHead(400, {'Content-Type': 'text/plain'});
        //     rsp.end(`Cannot complete password initial set or reset while already logged in.`);
        //     return;
        // }
        // if (!data.user[path.id]) {
        //     rsp.writeHead(404, {'Content-Type': 'text/plain'});
        //     rsp.end(`User ${path.id} not found.`);
        //     return;
        // }

        // if there is a token, check it against the user
        // if (querystring.token && data.user[path.id].token !== querystring.token) {
        //     rsp.writeHead(400, {'Content-Type': 'text/plain'});
        //     rsp.end('Invalid token.');
        //     return;
        // } else if (!querystring.token && path.id !== authUserData.userid) {
        //     rsp.writeHead(403, {'Content-Type': 'text/plain'});
        //     rsp.end('Unauthorized to change password.');
        //     return;
        // }

        rsp.writeHead(200, {'Content-Type': 'text/html'});
        // rsp.end(main.renderPage(req, TEMPLATE.password, main.getAuthUserData(req, data.user), querystring
        // ), data);
        rsp.end(main.renderPage(req, TEMPLATE.password, main.getAuthUserData(req, data.user), data, API_DIR));
        return;
    } else if (path.pathname === `${API_DIR}/forgot-password`) {
        if (authenticate(req, rsp, true)) {
            rsp.writeHead(400, {'Content-Type': 'text/plain'});
            rsp.end(`You are already logged in.`);
            return;
        }

        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end("temp");
        // rsp.end(main.renderPage(req, TEMPLATE.forgotPassword, forgotPassword(querystring), data));
        return;
    } else if (path.pathname === `${API_DIR}/auth`) {
        cookies = main.parseCookie(req.headers.cookie);
        if (cookies.user) {
            authUserData = data.user[cookies.user];
        } else {
            authUserData = {};
        }

        /*if (!authUserData.email) {
            rsp.writeHead(403, {'Content-Type': 'application/json'});
            rsp.end("{}");
            return;
        }*/

        rsp.writeHead(200, {'Content-Type': 'application/json'});
        rsp.end(JSON.stringify({
            "id": cookies.user,
            "email": authUserData.email,
            "role": authUserData.role,
            "location": authUserData.location || ""
        }));
        return;
    } else {
        return main.notFound(rsp, path.pathname, 'GET', req, data);
    }
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
        return rspGet(req, rsp);
    }

    if (!authenticate(req, rsp)) {
        return;
    }
    if (method === 'POST') {
        return rspPost(req, rsp, parsedBody);
    }
    if (method === 'PUT') {
        return rspPut(req, rsp, parsedBody);
    }

    if (method === 'DELETE') {
        return rspDelete(req, rsp);
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
    TEMPLATE.login = await readFile(`${__dirname}/resource/auth/login.html.mustache`, 'utf8');
    TEMPLATE.user = await readFile(`${__dirname}/resource/user/user.html.mustache`, 'utf8');
    TEMPLATE.users = await readFile(`${__dirname}/resource/user/users.html.mustache`, 'utf8');
    TEMPLATE.password = await readFile(`${__dirname}/resource/user/password.html.mustache`, 'utf8');
    TEMPLATE.forgotPassword = await readFile(`${__dirname}/resource/user/forgot-password.html.mustache`, 'utf8');
}

function startHTTP() {
    http.createServer(collectReqBody).listen(PORT, function () {
        console.log(`Server started on :${PORT}${API_DIR}`);
    });
}

init();
loadData().then(startHTTP);
