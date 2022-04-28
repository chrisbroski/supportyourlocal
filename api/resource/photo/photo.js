const fs = require("fs").promises;

const sharp = require("sharp");

// Custom libs
const main = require('../../inc/main.js');
const resourceName = 'photo';
const template = {};

function single(db, id, msg, error) {
    var resourceData = {
        "resourceName": resourceName,
        "pageName": 'Photos',
        "photos": main.objToArray(db.photo),
        "id": id,
        "width": db.photo[id].width,
        "height": db.photo[id].height,
        "size": db.photo[id].size,
        "storageUsed": Math.round(global.photoStorageUsed / 100000)
    };

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function list(db, msg, error) {
    var resourceData = {
        "resourceName": resourceName,
        "pageName": 'Photos',
        "photos": main.objToArray(db.photo),
        "storageUsed": Math.round(global.photoStorageUsed / 1000000),
        "storageLimit": Math.round(process.env.PHOTO_STORAGE_LIMIT / 1000000),
        "uploadFull": (process.env.PHOTO_STORAGE_LIMIT - global.photoStorageUsed < 0),
        "bytesLeft": Math.round((process.env.PHOTO_STORAGE_LIMIT - global.photoStorageUsed) / 1000000)
    };

    return Object.assign(main.addMessages(msg, error), resourceData);
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

this.fromFiles =  async function (path) {
    var photos = await fs.readdir(path);
    var fileTypes = [".jpg", ".jpeg", ".png"];

    photos = photos.filter(p => {
        var extension = p.slice(p.lastIndexOf(".")).toLowerCase();
        return (fileTypes.indexOf(extension) > -1);
    });

    var photo = {};
    await photos.forEach(async p => {
        const fileStats = await fs.stat(`${path}/${p}`);
        const metadata = await sharp(`${path}/${p}`).metadata();
        photo[p] = {};
        photo[p].size = fileStats.size;
        photo[p].width = metadata.width;
        photo[p].height = metadata.height;
    });

    return photo;
};

this.update = function (req, rsp, formData, db, save) {
    var error = isUpdateInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, list(db, [`${resourceName} updated.`]), db));
        return;
    }

    updateResource(formData, db, save);

    var returnData = main.responseData("", resourceName, db, "Updated", ["Band information updated."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.list, list(db, [`Photo added.`]), db));
};


function isPhotoInvalid(body) {
    var msg = [];
    var photoExt = [".png", ".jpg", ".jpeg", ".gif"];

    if (!body.files || body.files.length === 0) {
        msg.push("You must include a photo.");
        return msg;
    }

    if (!body.files || body.files[0].photo.length > 8000000) {
        msg.push("Photos over 8MB not allowed.");
    }

    if (photoExt.indexOf(body.files[0].type.toLowerCase()) === -1) {
        msg.push(`Only file types allowed: ${photoExt.join(", ")}`);
    }

    return msg;
}

this.remove = async function (req, rsp, id, db, save) {
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'DELETE', req, db);
    }

    global.photoStorageUsed -= db.photo[id].size;
    var filePath = `${process.env.PHOTO_PATH}/${id}`;
    fs.unlink(filePath);

    delete db.photo[id];
    save();

    var returnData = main.responseData(id, resourceName, db, "Deleted", [`${resourceName} '${id}' deleted.`]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db));
};

this.create = async function (req, rsp, body, db, save) {
    var photoId;
    var filePath;
    var error = isPhotoInvalid(body);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, list(db, [], error), db));
        return;
    }

    photoId = main.makeId();
    filePath = `${process.env.PHOTO_PATH}/${photoId}${body.files[0].type}`;

    await fs.writeFile(filePath, body.files[0].photo, 'binary');
    console.log('Photo saved.');
    db.photo[`${photoId}${body.files[0].type}`] = {};
    var size = body.files[0].photo.length;
    const metadata = await sharp(Buffer.from(body.files[0].photo, "binary")).metadata();
    db.photo[`${photoId}${body.files[0].type}`].size = size;
    db.photo[`${photoId}${body.files[0].type}`].width = metadata.width;
    db.photo[`${photoId}${body.files[0].type}`].height = metadata.height;
    save();

    global.photoStorageUsed += size;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.list, list(db, [`Photo added.`]), db));
};

this.get = function (req, rsp, id, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (id) {
        if (!db[resourceName][id]) {
            return main.notFound(rsp, req.url, 'GET', req, db);
        }
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, id);
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id), db));
    } else {
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, db.photo);
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, list(db), db));
    }
};

async function loadData() {
    template.single = await fs.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.list = await fs.readFile(`${__dirname}/${resourceName}s.html.mustache`, 'utf8');
}

loadData();