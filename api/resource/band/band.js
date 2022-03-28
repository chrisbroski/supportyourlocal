// Custom libs
const main = require('../../inc/main.js');
const resourceName = 'band';
const template = {};

function isUpdateInvalid(req, rsp, body, db, API_DIR) {
    var msg = [];

    if (!body.name) {
        msg.push('Band name is required.');
    }

    return main.invalidMsg(rsp, msg, req, db, API_DIR);
}

function updateResource(body, db, save) {
    db[resourceName].name = body.name;
    db[resourceName].desc = body.desc;
    db[resourceName].bio = body.bio;
    db[resourceName].contact = body.contact;
    
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
    db[resourceName].social.podcast = body["social-podcast"];

    save();
}

this.update = function (req, rsp, formData, db, save, API_DIR) {
    if (isUpdateInvalid(req, rsp, formData, db, API_DIR)) {
        return;
    }

    updateResource(formData, db, save);

    var returnData = main.responseData("", resourceName, db, "Updated", API_DIR, ["Band information updated."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db, API_DIR));
};

this.get = function (req, rsp, db, API_DIR) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, db.band);
    }
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.site, db.band, db, API_DIR));
};

async function loadData() {
    template.site = await main.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
}

loadData();
