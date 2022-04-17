const main = require('../../inc/main.js');

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
    db[resourceName][id].booking = formData.booking;
    save();
}

function single(db, id, msg, error) {
    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "pageName": db[resourceName][id].name,
        "countries": main.country(db[resourceName][id].country),
        "venues": main.objToArray(db[resourceName]).sort(main.sortByName)
    }, db[resourceName][id]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function list(db, msg, error, link) {
    var resourceData = main.objToArray(db[resourceName]).sort(main.sortByName);
    var returnData = {
        "venue": resourceData,
        "resourceName": resourceName,
        "countries": main.country(),
        "pageName": `${main.toTitleCase(resourceName)}s`
    };

    return Object.assign(main.addMessages(msg, error, link), returnData);
}

// remove booking info
function filteredVenue(venue) {
    var v = Object.assign({}, venue);
    delete v.booking;
    return v;
}

function singleData(db, id) {
    return Object.assign({"resourceName": resourceName}, filteredVenue(db[resourceName][id]));
}

function listData(db) {
    return main.objToArray(db[resourceName]).sort(main.sortByName).map(v => filteredVenue(v));
}

// Form validation
function isUpdateInvalid(req, rsp, formData) {
    var msg = [];

    if (!formData.name) {
        msg.push('Name is required.');
    }

    // return main.invalidMsg(rsp, msg, req, db, API_DIR);
    return msg;
}

this.create = function (req, rsp, formData, db, save, API_DIR) {
    var error = isUpdateInvalid(req, rsp, formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, Object.assign({
            "hasError": true,
            "error": error,
            "formData": formData
        }, list(db)), db, API_DIR));
        // ^ this needs selected values for country
        return;
    }

    var id = main.createResource(formData, db, save, resourceName, updateResource);
    var returnData = main.responseData(id, resourceName, db, "Created", API_DIR);

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", returnData.link);
        return main.returnJson(rsp, returnData, 201);
    }

    // returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    // rsp.end(main.renderPage(req, null, returnData, db, API_DIR));
    rsp.end(main.renderPage(req, template.list, Object.assign({
        "hasMsg": true,
        "link": {"text": `Created ${resourceName} id ${id}`, "href": `${API_DIR}/${resourceName}/${id}`}
    }, list(db)), db, API_DIR));
};

this.update = function (req, rsp, id, formData, db, save, API_DIR) {
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'PUT', req, db);
    }
    // if (isUpdateInvalid(rsp, formData)) {
    //     return;
    // }
    var error = isUpdateInvalid(req, rsp, formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id, "", error), db, API_DIR));
        return;
    }

    updateResource(id, formData, db, save);
    var returnData = main.responseData(id, resourceName, db, "Updated", API_DIR);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    // returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    // rsp.end(main.renderPage(req, null, returnData, db, API_DIR));
    rsp.end(main.renderPage(req, template.single, single(db, id, [`${resourceName} id ${id} updated.`]), db, API_DIR));
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
