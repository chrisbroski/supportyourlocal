/*jshint esversion: 6 */

// Custom libs
const main = require('../inc/main.js');
const resourceData = require('../inc/resource-data.js');

const resourceName = 'home';
const template = {};

function isUpdateInvalid(body) {
    console.log('isUpdateInvalid');
    var msg = [];
    return false;
    if (!body.name) {
        msg.push('Band name is required.');
    }
    if (!body.color1) {
        msg.push('Primary color is required.');
    }
    if (!body.color2) {
        msg.push('Secondary color is required.');
    }
    return msg;
}

function updateResource(body, db, save) {
    db[resourceName].name = body.name;
    db[resourceName].color1 = body.color1;
    db[resourceName].color2 = body.color2;
    db[resourceName].bio = body.bio;
    db[resourceName]["contact"] = body["contact"];

    if (!db[resourceName].social) {
        db[resourceName].social = {};
    }
    db[resourceName].social.fb = body["social-fb"];
    db[resourceName].social.spotify = body["social-spotify"];
    db[resourceName].social.instagram = body["social-instagram"];
    db[resourceName].social.youtube = body["social-youtube"];
    db[resourceName].social.anchor = body["social-anchor"];

    save();
}

this.update = function (req, rsp, formData, db, save) {
    if (isUpdateInvalid(rsp, formData)) {
        return;
    }

    updateResource(formData, db, save);

    var returnData = main.responseData("", resourceName, db, "Updated");

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, null, returnData, db));
};

function getCustomCSS(home) {
    var color1 = main.hexToRgb(home.color1);
    var color2 = main.hexToRgb(home.color2);
    return `:root {
    --color1: ${color1.r}, ${color1.g}, ${color1.b};
    --color2: ${color2.r}, ${color2.g}, ${color2.b};
}
`;
}

this.getHeader = function (req, rsp, data) {
    var header = `<header>
    <button><span class="material-icons">menu</span></button>
    <h1>${data.home.name}</h1>
</header>
`;

    var socials = [];
    if (data.home.social.fb) {
        socials.push(`        <a href="${data.home.social.fb}"><img src="/img/social/facebook.svg" alt="Facebook"></a>`);
    }
    if (data.home.social.spotify) {
        socials.push(`        <a href="${data.home.social.spotify}"><img src="/img/social/spotify.svg" alt="Spotify"></a>`);
    }
    if (data.home.social.instagram) {
        socials.push(`        <a href="${data.home.social.instagram}"><img src="/img/social/instagram.svg" alt="Instagram"></a>`);
    }
    if (data.home.social.youtube) {
        socials.push(`        <a href="${data.home.social.youtube}"><img src="/img/social/youtube.svg" alt="YouTube"></a>`);
    }
    if (data.home.social.anchor) {
        socials.push(`        <a href="${data.home.social.anchor}"><img src="/img/social/anchor.svg" alt="Anchor Podcasts"></a>`);
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
}

this.getCss = function (req, rsp, data, isCss) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'text/css' || isCss) {
        rsp.writeHead(200, {'Content-Type': 'text/css'});
        rsp.end(getCustomCSS(data.home));
        return;
    }
    return main.returnJson(rsp, data[resourceName]);
}

this.get = function (req, rsp, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, db.home);
    }
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.site, db.home, db));
};

async function loadData() {
    template.site = await main.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
}

loadData();
