/*jshint esversion: 8 */

const fs = require("fs");
const util = require('util');
const crypto = require("crypto");

const readFile = util.promisify(fs.readFile);
const resourceData = {};

// Global state
var data;
var saveTimer;
var saveDelay;

function makeId(bytes) {
    bytes = bytes || 24;
    const id = crypto.randomBytes(bytes).toString("base64");
    return id.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/, ".");
}
resourceData.makeId = makeId;

function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 1, 63, 'sha512').toString('base64');
}

resourceData.completePasswordReset = function (id, newPassword) {
    var salt = makeId(12);
    var hash = hashPassword(newPassword, salt);

    data.user[id].salt = salt;
    data.user[id].hash = hash;
    data.user[id].token = '';

    resourceData.save();
};

resourceData.setPassword = function (id, formData) {
    var salt = makeId(12);
    var hash = hashPassword(formData.passwordNew, salt);

    data.user[id].salt = salt;
    data.user[id].hash = hash;
    data.user[id].token = '';

    if (formData.firstName) {
        data.user[id].firstName = formData.firstName;
    }
    if (formData.surname) {
        data.user[id].surname = formData.surname;
    }
    resourceData.save();
};

function save(sync) {
    var dataPath = `${__dirname}/../../data/data.json`;
    // This is only meant to be used on exit, so no data is lost
    if (sync) {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, "    "));
        return;
    }

    if (saveTimer) {
        return;
    }
    saveTimer = setTimeout(function () {
        console.log('Persisting data...');
        fs.writeFile(dataPath, JSON.stringify(data, null, "    "), (err) => {
            if (err) {
                console.log(err);
            }
            console.log('Data saved.');
            saveTimer = null;
        });
    }, saveDelay);
}

resourceData.addUser = function (formData) {
    var id = makeId();
    var salt = makeId(12);
    var hash;

    if (formData.password) {
        hash = hashPassword(formData.password, salt);
    }

    data.user[id] = {};
    data.user[id].email = formData.email;
    data.user[id].role = formData.role || "administrator";
    // data.user[id].location = formData.location;

    data.user[id].token = (formData.password) ? '' : salt;
    data.user[id].salt = !formData.password ? '' : salt;
    data.user[id].hash = !formData.password ? '' : hash;

    save();
    return [id, salt];
};

resourceData.updateUser = function (id, formData, moderator) {
    data.user[id].email = formData.email;
    data.user[id].role = formData.role;
    data.user[id].location = formData.location;
    save();
};

function ifNotUndefinedUpdate(key, formData, obj) {
    if (formData[key] !== undefined) {
        obj[key] = formData[key];
    }
}

resourceData.patchUser = function (id, formData, moderator) {
    ifNotUndefinedUpdate("prefix", formData, data.user[id]);
    ifNotUndefinedUpdate("firstName", formData, data.user[id]);
    ifNotUndefinedUpdate("surname", formData, data.user[id]);
    ifNotUndefinedUpdate("email", formData, data.user[id]);
    ifNotUndefinedUpdate("company", formData, data.user[id]);
    ifNotUndefinedUpdate("title", formData, data.user[id]);
    ifNotUndefinedUpdate("imageUrl", formData, data.user[id]);
    ifNotUndefinedUpdate("data", formData, data.user[id]);
    ifNotUndefinedUpdate("bio", formData, data.user[id]);

    if (moderator) {
        ifNotUndefinedUpdate("userType", formData, data.user[id]);
        ifNotUndefinedUpdate("sponsorLevel", formData, data.user[id]);

        if (data.user[id].speaker !== undefined) {
            data.user[id].speaker = (formData.speaker) ? 1 : 0;
        }
        if (data.user[id].moderator !== undefined) {
            data.user[id].moderator = (formData.moderator) ? 1 : 0;
        }
        if (data.user[id].vendor !== undefined) {
            data.user[id].vendor = (formData.vendor) ? 1 : 0;
        }
        if (data.user[id].sponsor !== undefined) {
            data.user[id].sponsor = (formData.sponsor) ? 1 : 0;
        }
    }
    save();
};

resourceData.deleteUser = function (id) {
    delete data.user[id];
    save();
};

resourceData.resetPassword = function (id) {
    data.user[id].salt = '';
    data.user[id].hash = '';
    data.user[id].token = makeId(6);
    save();
    return data.user[id].token;
};

resourceData.load = async function (saveLag) {
    var dataPath = `${__dirname}/../../data/data.json`;
    var exampleDataPath = `${__dirname}/../../data/example.data.json`;
    var strData = await readFile(dataPath, 'utf8').catch(function (e) {
        console.log("No data.json found. Creating from example.data.json");
    });
    if (!strData) {
        strData = await readFile(exampleDataPath, 'utf8').catch(function (e) {
            console.log("Couldn't read example file.");
            console.log(e);
        });
    }

    data = JSON.parse(strData);

    saveDelay = saveLag || 10000;
    return data;
};

resourceData.save = save;

module.exports = resourceData;
