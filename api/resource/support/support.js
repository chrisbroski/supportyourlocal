const fs = require("fs").promises;
const showdown  = require('showdown');
const converter = new showdown.Converter({"noHeaderId": true, "simpleLineBreaks": true});

// Custom libs
const main = require('../../inc/main.js');
const resourceName = 'support';
const template = {};

function releaseList(db, id) {
    const releaseOptions = [];
    const releases = main.objToArray(db.release);
    releases.sort(main.sortByDateDesc);
    releases.forEach(r => {
        var selected = "";
        if (id && id === r.id) {
            selected = ' selected="selected"';
        }
        releaseOptions.push({
            "id": r.id,
            "name": main.releaseName(db, r.id),
            "selected": selected
        });
    });
    return releaseOptions;
}

function single(db, msg, error) {
    var resourceData = Object.assign({
        "resourceName": resourceName,
        "pageName": 'Support the Music',
        "releases": releaseList(db, db[resourceName].release)
    }, db[resourceName]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function singleNoAuth(db) {
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
        "pageName": 'Support the Music',
        "hasSocialMedia": Object.keys(socials).some(s => !!socials[s]),
        "hasPayment": Object.keys(payments).some(p => !!payments[p]),
        "donationSection": Object.keys(payments).some(p => !!payments[p]) || !!db[resourceName].donationMd,
        "subscribeSection": Object.keys(socials).some(s => !!socials[s]) || !!db[resourceName].subscribeMd,
        "releaseHtml": converter.makeHtml(db[resourceName].releaseMd),
        "donationHtml": converter.makeHtml(db[resourceName].donationMd),
        "subscribeHtml": converter.makeHtml(db[resourceName].subscribeMd),
        "releaseLinks": main.songLinks(db, db[resourceName].release)
    }, db.band);

    return Object.assign(resourceData, db[resourceName]);
}

function singleData(db) {
    var support = Object.assign({"resourceName": resourceName}, db[resourceName]);
    support.listen = [];
    support.listen = main.songLinks(db, support.release);
    // support.payments = db.band.payment;
    support.paymentUrl = {};
    var venmo = db.band.payment.venmo;
    support.paymentUrl.venmo = "";
    if (venmo) {
        if (venmo.slice(0, 1) === '@') {
            venmo = venmo.slice(1);
        }
        support.paymentUrl.venmo = `https://account.venmo.com/u/${venmo}`;
    }
    // social media
    support.social = db.band.social;
    return support;
}

// function isUpdateInvalid(body) {
//     var msg = [];
//
//     if (!body.name) {
//         msg.push('Band name is required.');
//     }
//
//     return msg;
// }

function updateResource(body, db, save) {
    if (!db[resourceName]) {
        db[resourceName] = {};
    }
    db[resourceName].releaseMd = body.releaseMd;
    db[resourceName].release = body.release;

    db[resourceName].donationMd = body.donationMd;
    db[resourceName].subscribeMd = body.subscribeMd;
    save();
}

this.update = function (req, rsp, formData, db, save) {
    // var error = isUpdateInvalid(formData);
    // if (error.length) {
    //     rsp.writeHead(400, {'Content-Type': 'text/html'});
    //     rsp.end(main.renderPage(req, template.band, single(db, [`${resourceName} updated.`]), db));
    //     return;
    // }

    updateResource(formData, db, save);

    var returnData = main.responseData("", resourceName, db, "Updated", ["Support information updated."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    // returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.support, single(db, [`${resourceName} updated.`]), db, process.env.SUBDIR));
};

this.get = function (req, rsp, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, singleData(db));
    }
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    if (main.isLoggedIn(req, db.user)) {
        rsp.end(main.renderPage(req, template.support, single(db), db));
    } else {
        rsp.end(main.renderPage(req, template.supportNoAuth, singleNoAuth(db), db));
    }
};

async function loadData() {
    template.support = await fs.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.supportNoAuth = await fs.readFile(`${__dirname}/${resourceName}-noauth.html.mustache`, 'utf8');
}

loadData();
