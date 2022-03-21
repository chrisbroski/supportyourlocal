/*jshint esversion: 6 */

// Custom libs
const main = require('../inc/main.js');
const resourceData = require('../inc/resource-data.js');

const resourceName = 'user';

// Form validation
function isUpdateInvalid(rsp, formData) {
    var msg = [];

    if (!formData.email) {
        msg.push('Email is required.');
    }

    if (!formData.password) {
        msg.push('Password is required.');
    }

    // also check for duplicate email

    return main.invalidMsg(rsp, msg);
}

this.update = function (req, rsp, id, formData, db) {
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'PUT', req, db);
    }
    if (isUpdateInvalid(rsp, formData)) {
        return;
    }

    resourceData.updateUser(id, formData);

    rsp.writeHead(200, {'Content-Type': 'text/plain'});
    rsp.end(`${resourceName} ${id} updated.`);
    return;
};

this.remove = function (req, rsp, id, resourceData, db) {
    if (!db[resourceName][id]) {
        return main.notFound(rsp, req.url, 'DELETE', req, db);
    }
    resourceData.deleteUser(id);
    rsp.writeHead(200, {'Content-Type': 'text/plain'});
    rsp.end(`${resourceName} id '${id}' deleted.`);
    return;
};

this.get = function (req, rsp, id, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (id) {
        if (!db[resourceName][id]) {
            return main.notFound(rsp, req.url, 'GET', req, db);
        }
        return main.returnJson(rsp, db[resourceName][id]);
    } else {
        return main.returnJson(rsp, main.objToArray(db[resourceName]));
    }
};
