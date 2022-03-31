const main = require('../../inc/main.js');

const resourceName = 'song';
const template = {};

function single(db, id) {
    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": db[resourceName][id].name,
        "genres": main.genre(db[resourceName][id].genre1)
    }, db[resourceName][id]);

    return resourceData;
}

function list(db) {
    var resourceData = main.objToArray(db[resourceName]).sort(main.sortByDateDesc);

    return {
        [resourceName]: resourceData,
        "today": main.dateFormat(new Date()),
        "resourceName": resourceName,
        "genres": main.genre()
    };
}

function singleData(db, id) {
    return Object.assign({"resourceName": resourceName}, db[resourceName][id]);
}

function listData(db) {
    return main.objToArray(db[resourceName]).sort(main.sortByDateDesc);
}

// Form validation
function isUpdateInvalid(req, rsp, formData, db, API_DIR) {
    var msg = [];

    if (!formData.name) {
        msg.push('Name is required.');
    }

    return main.invalidMsg(rsp, msg, req, db, API_DIR);
}

function updateResource(id, formData, db, save) {
    db[resourceName][id].name = formData.name;
    db[resourceName][id].artist = formData.artist;
    // db[resourceName][id].date = formData.date;
    db[resourceName][id].desc = formData.desc;
    db[resourceName][id].lyrics = formData.lyrics;
    db[resourceName][id].durationM = formData.durationM;
    db[resourceName][id].durationS = formData.durationS;

    db[resourceName][id].genre1 = formData.genre1;
    db[resourceName][id].genre2 = formData.genre2;
    db[resourceName][id].genre3 = formData.genre3;

    db[resourceName][id]["cover-front"] = formData["cover-front"];
    db[resourceName][id]["cover-back"] = formData["cover-back"];

    if (!db[resourceName][id].audio) {
        db[resourceName][id].audio = {};
    }
    db[resourceName][id].audio.spotify = formData.spotify;
    db[resourceName][id].audio.apple = formData.apple;
    db[resourceName][id].audio.amazon = formData.amazon;
    db[resourceName][id].audio.youtube = formData.youtube;
    db[resourceName][id].audio.cdbaby = formData.cdbaby;

    if (!db[resourceName][id].video) {
        db[resourceName][id].video = {};
    }
    db[resourceName][id].video.youtube = formData["video-youtube"];
    db[resourceName][id].video.cdbaby = formData["video-fb"];

    save();
}

this.create = function (req, rsp, formData, db, save, API_DIR) {
    if (isUpdateInvalid(req, rsp, formData, db)) {
        return;
    }

    var id = main.createResource(formData, db, save, resourceName, updateResource);
    var returnData = main.responseData(id, resourceName, db, "Created", API_DIR);

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", returnData.link);
        return main.returnJson(rsp, returnData, 201);
    }

    returnData.back = req.headers.referer;
    rsp.writeHead(201, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db, API_DIR));
};

this.update = function (req, rsp, id, formData, db, save, API_DIR) {
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'PUT', req, db);
    }
    if (isUpdateInvalid(req.headers.accept, rsp, formData, db)) {
        return;
    }

    // validate more fields
    updateResource(id, formData, db, save);
    var returnData = main.responseData(id, resourceName, db, "Updated", API_DIR);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db, API_DIR));
};

this.remove = function (req, rsp, id, db, save, API_DIR) {
    var name;
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'DELETE', req, db);
    }

    name = db[resourceName][id].name;
    delete db[resourceName][id];
    save();

    var returnData = main.responseData(id, resourceName, db, "Deleted", API_DIR, [`${resourceName} '${name}' deleted.`]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db, API_DIR));
};

this.get = function (req, rsp, id, db, API_DIR) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (id) {
        if (!db[resourceName][id]) {
            return main.notFound(rsp, req.url, 'GET', req, db);
        }
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, singleData(db, id));
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id), db, API_DIR));
    } else {
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, listData(db, req));
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, list(db), db, API_DIR));
    }
};

async function loadData() {
    template.single = await main.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.list = await main.readFile(`${__dirname}/${resourceName}s.html.mustache`, 'utf8');
}

loadData();
