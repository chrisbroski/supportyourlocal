// Custom libs
const main = require('../../inc/main.js');

const resourceName = 'site';
const template = {};

function single(db, msg, error) {
    var headerFontNormal = ' checked="checked"';
    var headerFontBold = '';
    if (db[resourceName]["header-font-weight"] === "bold") {
        headerFontNormal = '';
        headerFontBold = ' checked="checked"';
    }
    var resourceData = Object.assign({
        "resourceName": resourceName,
        "pageName": main.toTitleCase(resourceName),
        "header-font-normal": headerFontNormal,
        "header-font-bold": headerFontBold,
        "bg-photos": main.displayPhotos(db.photos, db[resourceName].background),
        "bg-no-photo": main.noPhotoSelected(db[resourceName].background),
        "thumb-photos": main.displayPhotos(db.photos, db[resourceName].thumbnail),
        "thumb-no-photo": main.noPhotoSelected(db[resourceName].thumbnail)
    }, db[resourceName]);

    // return resourceData;
    return Object.assign(main.addMessages(msg, error), resourceData);
}

function siteData(rsp, db) {
    main.returnJson(rsp, {
        "site": db.site,
        "band": db.band
    });
}

function isSetupInvalid(body, setupToken) {
    var msg = [];

    if (!body.name) {
        msg.push('Band name is required.');
    }
    if (!body.email) {
        msg.push('Email is required.');
    }
    if (!body.password) {
        msg.push('Password is required.');
    }
    if (body.password.length < 8) {
        msg.push('Password must be at least 8 characters.');
    }
    if (body.confirmPassword !== body.password) {
        msg.push("Passwords don't match.");
    }
    if (setupToken && body.setupToken !== setupToken) {
        msg.push("Invalid Setup Token.");
    }

    return msg;
}

function isUpdateInvalid(body) {
    var msg = [];

    if (!body.color1) {
        msg.push('Primary color is required.');
    }
    if (!body.color2) {
        msg.push('Secondary color is required.');
    }

    return msg;
    // return main.invalidMsg(rsp, msg, req, db, API_DIR);
}

function initialSetup(body, db, save) {
    db.band.name = body.name;

    var salt = main.makeId(12);
    var hash = main.hash(body.password, salt);

    var id = main.makeId();
    db.user[id] = {};

    db.user[id].email = body.email;
    db.user[id].salt = salt;
    db.user[id].hash = hash;
    db.user[id].token = '';

    save();
}

function updateResource(body, db, save) {
    db[resourceName].color1 = body.color1;
    db[resourceName].color2 = body.color2;

    db[resourceName]["header-font"] = body["header-font"];
    db[resourceName]["header-font-weight"] = body["header-font-weight"];
    db[resourceName]["header-font-default"] = body["header-font-default"];
    db[resourceName]["body-font"] = body["body-font"];
    db[resourceName]["body-font-default"] = body["body-font-default"];

    db[resourceName].background = body.background;
    db[resourceName].thumbnail = body.thumbnail;

    save();
}

this.setup = function (req, rsp, formData, db, save, API_DIR, setupToken) {
    // if (isSetupInvalid(req, rsp, formData, db, API_DIR, setupToken)) {
    //     return;
    // }
    var error = isSetupInvalid(formData, setupToken);

    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.list, Object.assign({
            "setup-token": formData.setupToken,
            "hasError": true,
            "error": error,
            "formData": formData
        }, single(db)), db, API_DIR));
        // ^ this needs selected values too
        return;
        //
        // rsp.writeHead(400, {'Content-Type': 'text/html'});
        // rsp.end(main.renderPage(req, template.start, {
        //     "setup-token": body.setupToken,
        //     "msg": msg,
        //     "name": body.name,
        //     "email": body.email
        // }, db, API_DIR));
        // return true;
    }

    initialSetup(formData, db, save);

    var returnData = main.responseData("", resourceName, db, "Updated", API_DIR, ["Site setup complete."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(303, {'Content-Type': 'text/plain', "Location": `${API_DIR}/login`});
    rsp.end("Site setup complete.");
};

this.update = function (req, rsp, formData, db, save, API_DIR) {
    var error = isUpdateInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, "", error), db, API_DIR));
        return;
    }

    updateResource(formData, db, save);

    var returnData = main.responseData("", resourceName, db, "Updated", API_DIR, ["Band information updated."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    // returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    // rsp.end(main.renderPage(req, null, returnData, db, API_DIR));
    rsp.end(main.renderPage(req, template.site, single(db, [`${resourceName} updated.`]), db, API_DIR));
};

function getCustomCSS(site) {
    var color1 = main.hexToRgb(site.color1);
    var color2 = main.hexToRgb(site.color2);
    var headerFont = "";
    var bodyFont = "";
    var fontImport = "";
    var fontWeight = "normal";
    var fonts = [];

    if (site["header-font"]) {
        fonts.push(`family=${encodeURI(site["header-font"])}`);
        headerFont = `'${site["header-font"]}', ${site["header-font-default"]}`;
    } else {
        headerFont = `${site["header-font-default"]}`;
    }
    if (site["body-font"]) {
        fonts.push(`family=${encodeURI(site["body-font"])}`);
        bodyFont = `'${site["body-font"]}', ${site["body-font-default"]}`;
    } else {
        bodyFont = `${site["body-font-default"]}`;
    }

    if (fonts.length > 0) {
        fontImport = `@import url('https://fonts.googleapis.com/css2?${fonts.join("&")}&display=swap');

`;
    }
    if (site["header-font-weight"]) {
        fontWeight = site["header-font-weight"];
    }

    return `${fontImport}:root {
    --color1: ${color1.r}, ${color1.g}, ${color1.b};
    --color2: ${color2.r}, ${color2.g}, ${color2.b};
    --header-font: ${headerFont};
    --header-font-weight: ${fontWeight};
    --body-font: ${bodyFont};
}
`;
}

this.getHeader = function (req, rsp, db) {
    var header;
    var socials = [];

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, {"site": db.site, "band": db.band});
    }
    header = `<header>
    <button><span class="material-icons">menu</span></button>
    <h1>${db.band.name}</h1>
</header>
`;

    if (db.band.social.fb) {
        socials.push(`        <a href="${db.band.social.fb}"><img src="/img/social/facebook.svg" alt="Facebook"></a>`);
    }
    if (db.band.social.spotify) {
        socials.push(`        <a href="${db.band.social.spotify}"><img src="/img/social/spotify.svg" alt="Spotify"></a>`);
    }
    if (db.band.social.instagram) {
        socials.push(`        <a href="${db.band.social.instagram}"><img src="/img/social/instagram.svg" alt="Instagram"></a>`);
    }
    if (db.band.social.youtube) {
        socials.push(`        <a href="${db.band.social.youtube}"><img src="/img/social/youtube.svg" alt="YouTube"></a>`);
    }
    if (db.band.social.podcast) {
        socials.push(`        <a href="${db.band.social.podcast}"><img src="/img/social/anchor.svg" alt="Podcast"></a>`);
    }

    var nav = `<nav id="main">
    <p><a href="/"><span class="material-icons">home</span> Home</a></p>
    <p><a href="/shows"><span class="material-icons">event</span> Shows</a></p>
    <p><a href="/about"><span class="material-icons">menu_book</span> About</a></p>
    <!--<p><a href="/songs"><span class="material-icons">music_note</span> Music</a></p>-->
    <p id="social">
${socials.join("\n")}
    </p>
</nav>`;

    rsp.writeHead(200, {'Content-Type': 'text/pht'});
    rsp.end(`${header}
${nav}
`);
};

this.getCss = function (req, rsp, data, isCss) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'text/css' || isCss) {
        rsp.writeHead(200, {'Content-Type': 'text/css'});
        rsp.end(getCustomCSS(data.site));
        return;
    }
    return main.returnJson(rsp, data[resourceName]);
};

this.start = function (req, rsp, db, API_DIR, qs) {
    // rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.start, {"setup-token": qs["setup-token"]}, db, API_DIR));
};

this.get = function (req, rsp, db, API_DIR) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'application/json') {
        return siteData(rsp, db);
    }
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.site, single(db), db, API_DIR));
};

async function loadData() {
    template.site = await main.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.start = await main.readFile(`${__dirname}/start.html.mustache`, 'utf8');
}

loadData();
