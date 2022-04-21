// const sharp = require('sharp');
// const fs = require("fs");fs
const fs = require("fs").promises;

// Custom libs
const main = require('../../inc/main.js');
const resourceName = 'photo';
const template = {};

function single(db, msg, error) {
    var resourceData = {
        "resourceName": resourceName,
        "pageName": 'Photos',
        "photos": db.photos
    };

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function singleNoAuth(db) {
    var resourceData = {
        "resourceName": resourceName,
        "pageName": 'Photos',
        "photos": db.photos
    };

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

    save();
}

this.update = function (req, rsp, formData, db, save, API_DIR) {
    var error = isUpdateInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, single(db, [`${resourceName} updated.`]), db, API_DIR));
        return;
    }

    updateResource(formData, db, save);

    var returnData = main.responseData("", resourceName, db, "Updated", API_DIR, ["Band information updated."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.list, single(db, [`Photo added.`]), db));
};


function isPhotoInvalid(body) {
    var msg = [];
    var photoExt = [".png", ".jpg", ".jpeg", ".gif"];

    if (photoExt.indexOf(body.files[0].type.toLowerCase()) === -1) {
        msg.push(`Only file types allowed: ${photoExt.join(", ")}`);
    }

    return msg;
}

this.create = function (req, rsp, body, db, save) {
    var photoId;
    var filePath;
    var error = isPhotoInvalid(body);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, single(db, [], error), db));
        return;
    }
    photoId = main.makeId();
    filePath = `${process.env.PHOTO_PATH}/${photoId}${body.files[0].type}`;
    fs.writeFile(filePath, body.files[0].photo, 'binary', (err) => {
        if (err) {
            console.log(err);
        }
        console.log('Photo saved.');
        db.photos.push(`${photoId}${body.files[0].type}`);
        save();
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, single(db, [`Photo added.`]), db));
    });
};

this.get = function (req, rsp, id, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');

    if (id) {
        if (!db[resourceName][id]) {
            return main.notFound(rsp, req.url, 'GET', req, db);
        }
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, db.photos[id]);
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id), db));
    } else {
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, db.photos);
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        if (main.isLoggedIn(req, db.user)) {
            rsp.end(main.renderPage(req, template.list, single(db), db));
        } else {
            rsp.end(main.renderPage(req, template.listNoAuth, singleNoAuth(db), db));
        }
    }
};

async function loadData() {
    template.single = await fs.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.list = await fs.readFile(`${__dirname}/${resourceName}s.html.mustache`, 'utf8');
    template.listNoAuth = await fs.readFile(`${__dirname}/${resourceName}-noauth.html.mustache`, 'utf8');
}

loadData();
