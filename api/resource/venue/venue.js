/*jshint esversion: 6 */

const main = require('../../inc/main.js');
var url = require('url');

const resourceName = 'venue';
const template = {};

function updateResource(id, formData, db, save) {
    db[resourceName][id].name = formData.name;
    db[resourceName][id].link = formData.link;
    db[resourceName][id].add1 = formData.add1;
    db[resourceName][id].add2 = formData.add2;
    db[resourceName][id].city = formData.city;
    db[resourceName][id].state = formData.state;
    db[resourceName][id].zip = formData.zip;
    db[resourceName][id].country = formData.country;
    db[resourceName][id].phone = formData.phone;
    db[resourceName][id].desc = formData.desc;
    save();
}

function single(db, id) {
    var venueData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": db[resourceName][id].name
    }, db[resourceName][id]);

    return venueData;
}

function list(db) {
    var venues = main.objToArray(db[resourceName]).sort(main.sortByName);
    return {
        "venue": venues,
        "resourceName": resourceName
    };
}

function singleData(db, id) {
    return Object.assign({"resourceName": resourceName}, db[resourceName][id]);
};

function listData(db, req) {
    return main.objToArray(db[resourceName]).sort(main.sortByName);
};

// Form validation
function isUpdateInvalid(rsp, formData) {
    var msg = [];

    if (!formData.name) {
        msg.push('Name is required.');
    }

    return main.invalidMsg(rsp, msg);
}

this.create = function (rsp, formData, db, save) {
    if (isUpdateInvalid(rsp, formData)) {
        return;
    }

    var id = main.createResource(formData, db, save, resourceName, updateResource);
    var returnData = main.responseData(id, resourceName, db, "Created");

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", returnData.link);
        return main.returnJson(rsp, returnData, true);
    }

    returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db));
};

this.update = function (req, rsp, id, formData, db, save) {
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'PUT', req, db);
    }
    if (isUpdateInvalid(rsp, formData)) {
        return;
    }

    updateResource(id, formData, db, save);
    var returnData = {
        "id": id,
        "data": db[resourceName][id],
        "link": `/api/${resourceName}/${id}`,
        "title": `Update ${resourceName}`
    };

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", returnData.link);
        return main.returnJson(rsp, returnData);
    }

    returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db));
};

this.remove = function (req, rsp, id, db, save) {
    var name;
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'DELETE', req, db);
    }

    name = db[resourceName][id].name;
    delete db[resourceName][id];
    save();

    var returnData = {
        "id": id,
        "link": `/api/${resourceName}/`,
        "title": `Delete ${resourceName}`,
        "msg": [`${resourceName} '${name}' deleted.`]
    };

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db));
};

this.get = function (req, rsp, id, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (id) {
        if (!db[resourceName][id]) {
            return main.notFound(rsp, req.url, 'GET', req, db);
        }
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, singleData(db, id));
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id), db));
    } else {
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, listData(db, req));
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, list(db), db));
    }
};

async function loadData() {
    template.single = await main.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.list = await main.readFile(`${__dirname}/${resourceName}s.html.mustache`, 'utf8');
}

loadData();
