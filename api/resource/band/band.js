const fs = require("fs").promises;
const showdown  = require('showdown');
const converter = new showdown.Converter({"noHeaderId": true, "simpleLineBreaks": true});

// Custom libs
const main = require('../../inc/main.js');
const resourceName = 'band';
const template = {};

function single(db, msg, error) {
    var resourceData = Object.assign({
        "resourceName": resourceName,
        "pageName": 'Band Info',
        "countries": main.country(db[resourceName].country),
    }, db[resourceName]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function singleNoAuth(db) {
    const members = [];
    Object.keys(db.user).forEach(u => {
        var memberData = {};
        var nameSeparator;
        var locSeparator;
        if (db.user[u].bandMember === "Y" && db.user[u].bio) {
            nameSeparator = (db.user[u].givenName && db.user[u].surname) ? " " : "";
            memberData.name = `${db.user[u].givenName}${nameSeparator}${db.user[u].surname}`;
            locSeparator = (db.user[u].city && db.user[u].state) ? ", " : "";
            memberData.location = `${db.user[u].city}${locSeparator}${db.user[u].state}`;
            memberData.bioHtml = converter.makeHtml(db.user[u].bio);
            memberData.photo = db.user[u].photo;
            members.push(memberData);
        }
    });

    var socials = {};
    if (db.band.social) {
        socials = db.band.social;
    }
    var payments = {};
    if (db.band.payment) {
        payments = db.band.payment;
    }
    var resourceData = Object.assign({
        "resourceName": resourceName,
        "pageName": 'About',
        "descHtml": converter.makeHtml(db.band.desc),
        "bioHtml": converter.makeHtml(db.band.bio),
        "contactHtml": converter.makeHtml(db.band.contact),
        "members": members,
        "hasSocialMedia": Object.keys(socials).some(s => !!socials[s]),
        "hasPayment": Object.keys(payments).some(p => !!payments[p])
    }, db[resourceName]);

    return resourceData;
}

function isUpdateInvalid(body) {
    var msg = [];

    if (!body.name) {
        msg.push('Band name is required.');
    }

    return msg;
}

function updateResource(body, db, save) {
    db[resourceName].name = body.name;
    db[resourceName].desc = body.desc;

    db[resourceName].bio = body.bio;
    db[resourceName].contact = body.contact;

    db[resourceName].city = body.city;
    db[resourceName].state = body.state;
    db[resourceName].country = body.country;

    db[resourceName].genre1 = body.genre1;
    db[resourceName].genre2 = body.genre2;
    db[resourceName].genre3 = body.genre3;

    if (!db[resourceName].social) {
        db[resourceName].social = {};
    }
    db[resourceName].social.fb = body["social-fb"];
    db[resourceName].social.spotify = body["social-spotify"];
    db[resourceName].social.instagram = body["social-instagram"];
    db[resourceName].social.youtube = body["social-youtube"];
    db[resourceName].social.tiktok = body["social-tiktok"];
    db[resourceName].social.podcast = body["social-podcast"];

    if (!db[resourceName].payment) {
        db[resourceName].payment = {};
    }
    db[resourceName].payment.venmo = body["pay-venmo"];

    save();
}

this.update = function (req, rsp, formData, db, save) {
    var error = isUpdateInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.band, single(db, [`${resourceName} updated.`]), db));
        return;
    }

    updateResource(formData, db, save);

    var returnData = main.responseData("", resourceName, db, "Updated", ["Band information updated."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    // returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.band, single(db, [`${resourceName} updated.`]), db, process.env.SUBDIR));
};

this.get = function (req, rsp, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, db.band);
    }
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    if (main.isLoggedIn(req, db.user)) {
        rsp.end(main.renderPage(req, template.band, single(db), db));
    } else {
        rsp.end(main.renderPage(req, template.bandNoAuth, singleNoAuth(db), db));
    }
};

async function loadData() {
    template.band = await fs.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.bandNoAuth = await fs.readFile(`${__dirname}/${resourceName}-noauth.html.mustache`, 'utf8');
}

loadData();
