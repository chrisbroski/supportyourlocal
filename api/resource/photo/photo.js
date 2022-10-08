const fs = require("fs").promises;

const sharp = require("sharp");

// Custom libs
const main = require('../../inc/main.js');
const resourceName = 'photo';
const template = {};

function photoList(db) {
    return main.objToArray(db.photo).map(p => {
        p.sizeKb = (p.size / 1000).toLocaleString("en-US", {maximumFractionDigits: 0});
        return p;
    });
}

function single(db, id, msg, error) {
    var resourceData = {
        "resourceName": resourceName,
        "pageName": 'Photos',
        "photos": photoList(db),
        "id": id,
        "width": db.photo[id].width,
        "height": db.photo[id].height,
        "web": db.photo[id].web,
        "name": db.photo[id].name,
        "ext": db.photo[id].ext,
        "size": db.photo[id].size,
        "sizeKb": (db.photo[id].size / 1000).toLocaleString("en-US", {maximumFractionDigits: 0}),
        "storageUsed": Math.round(global.photoStorageUsed / 100000)
    };

    return Object.assign(main.addMessages(msg, error), resourceData);
}

var photoExt = [".png", ".jpg", ".jpeg"];
function list(db, msg, error) {
    var resourceData = {
        "resourceName": resourceName,
        "accept": photoExt.join(","),
        "pageName": 'Photos',
        "photos": photoList(db),
        "storageUsed": Math.round(global.photoStorageUsed / 1000000),
        "storageLimit": Math.round(process.env.PHOTO_STORAGE_LIMIT / 1000000),
        "uploadFull": (process.env.PHOTO_STORAGE_LIMIT - global.photoStorageUsed < 0),
        "bytesLeft": Math.round((process.env.PHOTO_STORAGE_LIMIT - global.photoStorageUsed) / 1000000)
    };

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function isPhotoInvalid(body) {
    var msg = [];

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
    var thumbPath = `${process.env.PHOTO_PATH}/${db[resourceName][id].name}_thumb${db[resourceName][id].ext}`;
    fs.unlink(thumbPath);

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
    var photoName;
    var photoExt;
    var filePath;
    var thumbPath;
    var webPath;
    var photoSizeLimit = parseInt(process.env.PHOTO_SIZE_LIMIT, 10);
    var photoWebSize = parseInt(process.env.PHOTO_WEB_SIZE, 10);

    var error = isPhotoInvalid(body);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, list(db, [], error), db));
        return;
    }

    photoId = main.makeId();
    photoExt = body.files[0].type;
    photoName = `${photoId}${photoExt}`;
    filePath = `${process.env.PHOTO_PATH}/${photoName}`;
    thumbPath = `${process.env.PHOTO_PATH}/${photoId}_thumb${photoExt}`;
    webPath = `${process.env.PHOTO_PATH}/${photoId}_web${photoExt}`;
    db.photo[photoName] = {};

    var uploadedPhoto = await sharp(Buffer.from(body.files[0].photo, "binary"));
    const metadata = await uploadedPhoto.metadata();
    if (photoExt.toLowerCase() === ".png") {
        uploadedPhoto.png({palette: true}).toFile(filePath);
        uploadedPhoto.resize({height: 200}).png({palette: true}).toFile(thumbPath);

        if (metadata.width > photoSizeLimit || metadata.height > photoSizeLimit) {
            db.photo[photoName].web = true;
            if (metadata.width > metadata.height) {
                uploadedPhoto.resize({width: photoWebSize}).png({palette: true}).toFile(webPath);
            } else {
                uploadedPhoto.resize({height: photoWebSize}).png({palette: true}).toFile(webPath);
            }
        } else {
            db.photo[photoName].web = false;
        }
    } else {
        uploadedPhoto.toFile(filePath);
        uploadedPhoto.resize({height: 200}).toFile(thumbPath);
        
        if (metadata.width > photoSizeLimit || metadata.height > photoSizeLimit) {
            db.photo[photoName].web = true;
            if (metadata.width > metadata.height) {
                uploadedPhoto.resize({width: photoWebSize}).jpeg({quality: 70}).toFile(webPath);
            } else {
                uploadedPhoto.resize({height: photoWebSize}).jpeg({quality: 70}).toFile(webPath);
            }
        } else {
            db.photo[photoName].web = false;
        }
    }

    console.log('Photo saved.');
    var size = body.files[0].photo.length;

    db.photo[photoName].name = photoId;
    db.photo[photoName].ext = photoExt;
    db.photo[photoName].size = size;
    db.photo[photoName].width = metadata.width;
    db.photo[photoName].height = metadata.height;
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
