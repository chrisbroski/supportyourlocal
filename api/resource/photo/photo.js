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

function list(db, msg, error) {
    var resourceData = {
        "resourceName": resourceName,
        "pageName": 'Photos',
        "photos": photoList(db),
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

// Start - This imports current photos for backward compatibility
function hasThumbnail(thumbs, fileName, ext) {
    return thumbs.some(t => {
        return t === `${fileName}_thumb${ext}`;
    });
}

function hasWeb(webs, fileName, ext) {
    // console.log(thumbs);
    return webs.some(t => {
        // console.log(t, `${fileName}_thumb${ext}`);
        return t === `${fileName}_web${ext}`;
    });
}

function isThumb(fileName, ext) {
    // console.log(fileName, ext);
    var suffixPosition = fileName.length - `_thumb${ext}`.length;
    return fileName.indexOf(`_thumb${ext}`) === suffixPosition;
}

function isWeb(fileName, ext) {
    var suffixPosition = fileName.length - `_web${ext}`.length;
    return fileName.indexOf(`_web${ext}`) === suffixPosition;
}

this.fromFiles = async function (path) {
    var photos = await fs.readdir(path);
    var fileTypes = [".jpg", ".jpeg", ".png"];
    var photoSizeLimit = parseInt(process.env.PHOTO_SIZE_LIMIT, 10);
    var photoWebSize = parseInt(process.env.PHOTO_WEB_SIZE, 10);

    photos = photos.filter(p => {
        var ext = p.slice(p.lastIndexOf(".")).toLowerCase();
        return (fileTypes.indexOf(ext) > -1);
    });

    var photo = {};
    var thumbs = [];
    var webs = [];
    photos.forEach(p => {
        var ext = p.slice(p.lastIndexOf("."));
        var name = p.slice(0, p.lastIndexOf("."));
        // var suffixPosition = p.length - `_thumb${ext}`.length;
        // console.log(p, ext, isThumb(p, ext));
        if (isThumb(p, ext)) {
            thumbs.push(`${name}${ext}`);
        } else if (isWeb(p, ext)) {
            webs.push(`${name}${ext}`);
        } else {
            photo[p] = {};
            photo[p].name = name;
            photo[p].ext = ext;
        }
    });

    // console.log(photo);

    await Object.keys(photo).forEach(async p => {
        const fileStats = await fs.stat(`${path}/${p}`);
        const metadata = await sharp(`${path}/${p}`).metadata();

        // Create thumbnail, if needed
        if (!hasThumbnail(thumbs, photo[p].name, photo[p].ext)) {
            if (photo[p].ext.toLowerCase() === ".png") {
                sharp(`${path}/${photo[p].name}${photo[p].ext}`)
                    .resize({height: 200})
                    .png({palette: true})
                    .toFile(`${path}/${photo[p].name}_thumb${photo[p].ext}`);
                // if (metadata.width > photoSizeLimit || metadata.height > photoSizeLimit) {
                //     photo[p].web = true;
                //     if (metadata.width > metadata.height) {
                //         sharp(`${path}/${photo[p].name}${photo[p].ext}`)
                //             .resize({width: photoWebSize})
                //             .png({palette: true})
                //             .toFile(`${path}/${photo[p].name}_web${photo[p].ext}`);
                //     } else {
                //         sharp(`${path}/${photo[p].name}${photo[p].ext}`)
                //             .resize({height: photoWebSize})
                //             .png({palette: true})
                //             .toFile(`${path}/${photo[p].name}_web${photo[p].ext}`);
                //     }
                // } else {
                //     photo[p].web = false;
                // }
            } else {
                sharp(`${path}/${photo[p].name}${photo[p].ext}`)
                    .resize({height: 200})
                    .jpeg({quality: 70})
                    .toFile(`${path}/${photo[p].name}_thumb${photo[p].ext}`);
                // if (metadata.width > photoSizeLimit || metadata.height > photoSizeLimit) {
                //     photo[p].web = true;
                //     if (metadata.width > metadata.height) {
                //         sharp(`${path}/${photo[p].name}${photo[p].ext}`)
                //             .resize({width: photoWebSize})
                //             .jpeg({quality: 70})
                //             .toFile(`${path}/${photo[p].name}_web${photo[p].ext}`);
                //     } else {
                //         sharp(`${path}/${photo[p].name}${photo[p].ext}`)
                //             .resize({height: photoWebSize})
                //             .jpeg({quality: 70})
                //             .toFile(`${path}/${photo[p].name}_web${photo[p].ext}`);
                //     }
                // } else {
                //     photo[p].web = false;
                // }
            }
        }

        // Create web size, if needed
        if (!hasWeb(webs, photo[p].name, photo[p].ext)) {
            if (photo[p].ext.toLowerCase() === ".png") {
                if (metadata.width > photoSizeLimit || metadata.height > photoSizeLimit) {
                    photo[p].web = true;
                    if (metadata.width > metadata.height) {
                        sharp(`${path}/${photo[p].name}${photo[p].ext}`)
                            .resize({width: photoWebSize})
                            .png({palette: true})
                            .toFile(`${path}/${photo[p].name}_web${photo[p].ext}`);
                    } else {
                        sharp(`${path}/${photo[p].name}${photo[p].ext}`)
                            .resize({height: photoWebSize})
                            .png({palette: true})
                            .toFile(`${path}/${photo[p].name}_web${photo[p].ext}`);
                    }
                } else {
                    photo[p].web = false;
                }
            } else {
                if (metadata.width > photoSizeLimit || metadata.height > photoSizeLimit) {
                    photo[p].web = true;
                    if (metadata.width > metadata.height) {
                        sharp(`${path}/${photo[p].name}${photo[p].ext}`)
                            .resize({width: photoWebSize})
                            .jpeg({quality: 70})
                            .toFile(`${path}/${photo[p].name}_web${photo[p].ext}`);
                    } else {
                        sharp(`${path}/${photo[p].name}${photo[p].ext}`)
                            .resize({height: photoWebSize})
                            .jpeg({quality: 70})
                            .toFile(`${path}/${photo[p].name}_web${photo[p].ext}`);
                    }
                } else {
                    photo[p].web = false;
                }
            }
        } else {
            photo[p].web = true;
        }
        photo[p].size = fileStats.size;
        photo[p].width = metadata.width;
        photo[p].height = metadata.height;
    });

    return photo;
};
// End - This imports current photos for backward compatibility

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
    var photoExt = [".png", ".jpg", ".jpeg"];

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
        // console.log(metadata.width, photoSizeLimit, metadata.width > photoSizeLimit);
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
    // await fs.writeFile(filePath, body.files[0].photo, 'binary');

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
