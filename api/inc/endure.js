const fs = require("fs");
const util = require('util');

const readFile = util.promisify(fs.readFile);
const endure = {};

// Global state
var saveTimer;
var saveDelay;
var dataPath;
var db;

function save(sync) {
    var dataPath = `${__dirname}/../../data/data.json`;
    // This is only meant to be used on exit, so no data is lost
    if (sync) {
        fs.writeFileSync(dataPath, JSON.stringify(db, null, "    "));
        return;
    }

    if (saveTimer) {
        return;
    }
    saveTimer = setTimeout(function () {
        console.log('Persisting data...');
        fs.writeFile(dataPath, JSON.stringify(db, null, "    "), (err) => {
            if (err) {
                console.log(err);
            }
            console.log('Data saved.');
            saveTimer = null;
        });
    }, saveDelay);
}

endure.load = async function (dataFilePath, saveLag) {
    dataPath = dataFilePath;
    var dataFile = `${dataFilePath}/data.json`;
    var exampleData = `${dataFilePath}/example.data.json`;
    var strData = await readFile(dataFile, 'utf8').catch(function () {
        console.log("No data.json found. Creating from example.data.json");
    });
    if (!strData) {
        strData = await readFile(exampleData, 'utf8').catch(function (e) {
            console.log("Couldn't read example file.");
            console.log(e);
        });
    }
    db = JSON.parse(strData);
    saveDelay = saveLag || 10000;
    return db;
};

endure.save = save;

module.exports = endure;
