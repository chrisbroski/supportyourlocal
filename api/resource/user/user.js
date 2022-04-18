const main = require('../../inc/main.js');
const resourceName = 'user';
const template = {};

function createUserName(user) {
    if (user.givenName && user.surname) {
        return `${user.givenName} ${user.surname}`;
    }
    if (user.givenName) {
        return user.givenName;
    }
    if (user.surname) {
        return user.surname;
    }
    return user.email;
}

function single(db, id, req, msg, error) {
    var authUserData = main.getAuthUserData(req, db.user);
    var pageName = db[resourceName][id].email;
    // var pageName = `${db[resourceName][id].givenName} ${db[resourceName][id].surname}`;
    var givenName = db[resourceName][id].givenName;
    var surname = db[resourceName][id].surname;
    if (givenName || surname) {
        pageName = pageName = `${db[resourceName][id].givenName} ${db[resourceName][id].surname}`;
    }
    var users = main.objToArray(db[resourceName]).sort(main.sortByDateDesc);
    users.forEach(u => {
        u.userName = createUserName(u);
    });

    var resourceData = Object.assign({
        "id": id,
        "resourceName": resourceName,
        "resourceDisplayName": "Members",
        "pageName": pageName,
        "adminChecked": !!db[resourceName][id].admin ? ' checked="checked"' : '',
        "memberChecked": !!db[resourceName][id].bandMember ? ' checked="checked"' : '',
        "isOwnUser": (authUserData.userid === id),
        "countries": main.country(db[resourceName][id].country),
        "photos": main.displayPhotos(db.photos, db[resourceName][id].photo),
        "no-photo": main.noPhotoSelected(db[resourceName][id].photo),
        "users": users
    }, db[resourceName][id]);

    // return resourceData;
    return Object.assign(main.addMessages(msg, error), resourceData);
}

function list(db, msg, error, link) {
    var resourceData =  {
        [resourceName]: main.objToArray(db[resourceName]).sort(main.sortByDateDesc),
        "today": main.dateFormat(new Date()),
        "resourceName": resourceName,
        "countries": main.country(),
        "photos": main.displayPhotos(db.photos),
        "no-photo": main.noPhotoSelected(),
        "pageName": "Members"
    };

    resourceData[resourceName].forEach(u => {
        u.userName = createUserName(u);
    });

    return Object.assign(main.addMessages(msg, error, link), resourceData);
}

function filteredUser(user) {
    var u = Object.assign({}, user);
    delete u.hash;
    delete u.salt;
    delete u.token;
    return u;
}

function singleData(db, id) {
    return Object.assign({"resourceName": resourceName}, filteredUser(db[resourceName][id]));
}

function listData(db) {
    return main.objToArray(db[resourceName]).sort(main.sortByDateDesc).map(u => filteredUser(u));
}

function checkEmailExists(email, users) {
    return Object.keys(users).some(function (id) {
        return users[id].email === email;
    });
}

// Form validation
function isCreateInvalid(req, rsp, formData, db) {
    var msg = [];

    if (!formData.email) {
        msg.push('Email is required.');
    }

    if (checkEmailExists(formData.email, db.user)) {
        msg.push(`Email ${formData.email} already exists.`);
    }

    // return main.invalidMsg(rsp, msg, req, db, API_DIR);
    return msg;
}
function isUpdateInvalid(req, rsp, formData) {
    var msg = [];

    if (!formData.email) {
        msg.push('Email is required.');
    }

    // return main.invalidMsg(rsp, msg, req, db, API_DIR);
    return msg;
}

function updateResource(id, formData, db, save) {
    db[resourceName][id].email = formData.email;
    db[resourceName][id].givenName = formData.givenName;
    db[resourceName][id].surname = formData.surname;
    db[resourceName][id].admin = formData.admin;
    db[resourceName][id].bandMember = formData.bandMember;
    db[resourceName][id].desc = formData.desc;
    db[resourceName][id].bio = formData.bio;
    db[resourceName][id].city = formData.city;
    db[resourceName][id].state = formData.state;
    db[resourceName][id].country = formData.country;
    db[resourceName][id].photo = formData.photo;
    db[resourceName][id].position = formData.position;

    save();
}

this.create = function (req, rsp, formData, db, save, API_DIR) {
    var error = isCreateInvalid(req, rsp, formData, db);
    var returnData;
    if (error.length) {
        returnData = Object.assign({
            "hasError": true,
            "error": error,
            "formData": formData
        }, list(db));
        returnData.countries = main.country(formData.country);
        returnData.photos = main.displayPhotos(db.photos, formData.photo);

        returnData.adminChecked = (formData.admin === "Y") ? ' checked="checked"': "";
        returnData.memberChecked = (formData.bandMember === "Y") ? ' checked="checked"': "";
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, returnData, db, API_DIR));
        return;
    }

    var id = main.createResource(formData, db, save, resourceName, updateResource);
    db[resourceName][id].token = main.makeId(12);

    returnData = main.responseData(id, resourceName, db, "Created", API_DIR);

    if (req.headers.accept === 'application/json') {
        rsp.setHeader("Location", returnData.link);
        return main.returnJson(rsp, returnData, 201);
    }

    rsp.writeHead(201, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.list, Object.assign({
        "hasMsg": true,
        "link": {"text": `Created ${resourceName} id ${id}`, "href": `${API_DIR}/${resourceName}/${id}`}
    }, list(db)), db, API_DIR));
};

this.update = function (req, rsp, id, formData, db, save, API_DIR) {
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'PUT', req, db);
    }
    // validate more fields
    var error = isUpdateInvalid(req, rsp, formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id, req, "", error), db, API_DIR));
        return;
    }

    updateResource(id, formData, db, save);
    var returnData = main.responseData(id, resourceName, db, "Updated", API_DIR);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    // returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, id, req, [`${resourceName} id ${id} updated.`]), db, API_DIR));
    // rsp.end(main.renderPage(req, null, returnData, db, API_DIR));
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
        rsp.end(main.renderPage(req, template.single, single(db, id, req), db, API_DIR));
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
