const fs = require("fs").promises;
const showdown  = require('showdown');
const converter = new showdown.Converter({"noHeaderId": true, "simpleLineBreaks": true});
const main = require('../../inc/main.js');

const resourceName = 'style';
const template = {};

function single(db, msg, error) {
    var resourceData = Object.assign({
        "resourceName": resourceName,
        "logo1-photos": main.displayPhotos(db.photo, db[resourceName].logo1),
        "logo1-no-photo": main.noPhotoSelected(db[resourceName].logo1),
        "logo2-photos": main.displayPhotos(db.photo, db[resourceName].logo2),
        "logo2-no-photo": main.noPhotoSelected(db[resourceName].logo2),
        "logo3-photos": main.displayPhotos(db.photo, db[resourceName].logo3),
        "logo3-no-photo": main.noPhotoSelected(db[resourceName].logo3)
    }, db[resourceName]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function hasLogo(styleData) {
    return (styleData.logoRules || styleData.logo1 || styleData.logo2 || styleData.logo3);
}

function singleNoAuth(db, msg, error) {
    var resourceData = Object.assign({
        "resourceName": resourceName,
        "logoRulesHtml": converter.makeHtml(db[resourceName].logoRules),
        "toneHtml": converter.makeHtml(db[resourceName].tone),
        "hasLogo": hasLogo(db.style)
    }, db[resourceName]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function singleData(db) {
    return Object.assign({
        "resourceName": resourceName,
    }, db[resourceName]);
}

function isUpdateInvalid(body) {
    var msg = [];

    if (!body.color1 && !body.colo2) {
        msg.push('Two colors are required.');
    }

    return msg;
}

function updateResource(body, db, save) {
    db[resourceName].logoRules = body.logoRules;
    db[resourceName].logo1 = body.logo1;
    db[resourceName].logo2 = body.logo2;
    db[resourceName].logo3 = body.logo3;

    db[resourceName].color1 = body.color1;
    db[resourceName].color2 = body.color2;
    db[resourceName].color3 = body.color3;
    db[resourceName].color4 = body.color4;
    db[resourceName].color5 = body.color5;
    db[resourceName].color6 = body.color6;

    db[resourceName].font1 = body.font1;
    db[resourceName].font2 = body.font2;
    db[resourceName].font3 = body.font3;
    db[resourceName].fontMonospace = body.fontMonospace;

    db[resourceName].tone = body.tone;

    save();
}

this.update = function (req, rsp, formData, db, save) {
    var error = isUpdateInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, "", error), db));
        return;
    }

    updateResource(formData, db, save);

    var returnData = main.responseData("", resourceName, db, "Updated", ["Style information updated."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, [`${resourceName} updated.`]), db));
};

this.get = function (req, rsp, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, singleData(db));
    }
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    if (main.isLoggedIn(req, db.user)) {
        rsp.end(main.renderPage(req, template.single, single(db), db));
    } else {
        rsp.end(main.renderPage(req, template.singleNoAuth, singleNoAuth(db), db));
    }
};

async function loadData() {
    template.single = await fs.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.singleNoAuth = await fs.readFile(`${__dirname}/${resourceName}-noauth.html.mustache`, 'utf8');
}

loadData();
