const fs = require("fs").promises;

// Custom libs
const main = require('../../inc/main.js');
const resourceName = 'font';
const template = {};
const fontMax = 6;

function single(db, id, msg, error) {
    var resourceData = {
        "resourceName": resourceName,
        "pageName": id.slice(0, id.lastIndexOf(".")),
        "fonts": db.font,
        "id": id
    };

    return Object.assign(main.addMessages(msg, error), resourceData);
}

var fontExt = [".ttf", ".otf", ".woff", ".woff2"];
function list(db, msg, error) {
    var fontCount = 0;
    if (db.font) {
        fontCount = db.font.length;
    }
    var resourceData = {
        "resourceName": resourceName,
        "accept": fontExt.join(","),
        "pageName": 'Fonts',
        "fonts": db.font,
        "fontCount": fontCount,
        "fontMax": fontMax,
        "full": db.font && db.font.length >= fontMax
    };

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function isFontInvalid(body) {
    var msg = [];

    if (!body.files || body.files.length === 0) {
        msg.push("You must include a font file.");
        return msg;
    }

    if (!body.files || body.files[0].font.length > 8000000) {
        msg.push("Fonts sized over 8MB not allowed.");
    }

    if (fontExt.indexOf(body.files[0].type.toLowerCase()) === -1) {
        msg.push(`Only file types allowed: ${fontExt.join(", ")}`);
    }

    return msg;
}

this.remove = async function (req, rsp, id, db, save) {
    if (db[resourceName].indexOf(id) === -1) {
        return main.notFound(rsp, req.url, 'DELETE', req, db);
    }

    var filePath = `${process.env.PHOTO_PATH}/${id}`;
    fs.unlink(filePath);

    db.font.splice(db.font.indexOf(id), 1);
    save();

    var returnData = main.responseData(id, resourceName, db, "Deleted", [`${resourceName} '${id}' deleted.`]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db));
};

this.create = async function (req, rsp, body, db, save) {
    var error = isFontInvalid(body);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, list(db, [], error), db));
        return;
    }

    if (!db.font) {
        db.font = [];
    }
    var fileName = body.files[0].filename;
    await fs.writeFile(`${process.env.PHOTO_PATH}/${fileName}`, body.files[0].font, 'binary');
    db.font.push(fileName);
    save();

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.list, list(db, [`Photo added.`]), db));
};

this.get = function (req, rsp, id, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (id) {
        if (db[resourceName].indexOf(id) === -1) {
            return main.notFound(rsp, req.url, 'GET', req, db);
        }
        if (req.headers.accept === 'application/json') {
            // return main.returnJson(rsp, id);
        }
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, id), db));
    } else {
        if (req.headers.accept === 'application/json') {
            return main.returnJson(rsp, db.font);
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
