const fs = require("fs").promises;
const showdown  = require('showdown');
const converter = new showdown.Converter({"noHeaderId": true, "simpleLineBreaks": true});
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
        "header-sans-serif-selected": db.site["header-font-default"] === "sans-serif" ? ' selected="selected"' : '',
        "header-serif-selected": db.site["header-font-default"] === "serif" ? ' selected="selected"' : '',
        "header-monospace-selected": db.site["header-font-default"] === "monospace" ? ' selected="selected"' : '',
        "header-cursive-selected": db.site["header-font-default"] === "cursive" ? ' selected="selected"' : '',
        "header-fantasy-selected": db.site["header-font-default"] === "fantasy" ? ' selected="selected"' : '',
        "header-font-bold": headerFontBold,
        "body-sans-serif-selected": db.site["body-font-default"] === "sans-serif" ? ' selected="selected"' : '',
        "body-serif-selected": db.site["body-font-default"] === "serif" ? ' selected="selected"' : '',
        "body-monospace-selected": db.site["body-font-default"] === "monospace" ? ' selected="selected"' : '',
        "body-cursive-selected": db.site["body-font-default"] === "cursive" ? ' selected="selected"' : '',
        "body-fantasy-selected": db.site["body-font-default"] === "fantasy" ? ' selected="selected"' : '',
        "bg-photos": main.displayPhotos(db.photos, db[resourceName].background),
        "bg-no-photo": main.noPhotoSelected(db[resourceName].background),
        "thumb-photos": main.displayPhotos(db.photos, db[resourceName].thumbnail),
        "thumb-no-photo": main.noPhotoSelected(db[resourceName].thumbnail)
    }, db[resourceName]);

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
    var error = isSetupInvalid(formData, setupToken);

    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.start, {
            "setup-token": formData.setupToken,
            "hasError": true,
            "error": error,
            "formData": formData
        }, db));
        return;
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
        rsp.end(main.renderPage(req, template.single, single(db, "", error), db));
        return;
    }

    updateResource(formData, db, save);

    var returnData = main.responseData("", resourceName, db, "Updated", API_DIR, ["Band information updated."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.site, single(db, [`${resourceName} updated.`]), db));
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
    <p><a href="/music"><span class="material-icons">library_music</span> Music</a></p>
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

function homeNoAuth(db) {
    var now = new Date();
    var homeData = {
        "announcements": []
    };
    //announcements
    var hasAnnouncements = false;
    var data = Object.keys(db.announcement);
    data.forEach(id => {
        var announcement;
        if (db.announcement[id].pinned === "Y") {
            announcement = Object.assign({}, db.announcement[id]);
            hasAnnouncements = true;
            announcement.announcement = converter.makeHtml(db.announcement[id].copy);
            if (db.announcement[id].song) {
                announcement.songLink = {};
                announcement.songLink.url = db.song[db.announcement[id].song].audio.spotify;
                announcement.songLink.text = db.song[db.announcement[id].song].name;
            }
            homeData.announcements.push(announcement);
        }
    });
    homeData.announcements = homeData.announcements.sort(main.sortByDateDesc);
    homeData.hasAnnouncements = hasAnnouncements;

    // gigs: get gigs >= today. there there are any, mark hasUpcomingShows true and get the next one
    // var hasUpcomingShows = false;
    data = main.objToArray(db.gig).sort(main.sortByDate);
    var totalGigs = data.length;
    // gigData.gigs.sort(main.sortByDate);
    data = data.filter(gig => {
        return Date.parse(gig.date + "T23:59:59") >= +now;
    });
    if (data.length > 0) {
        // hasUpcomingShows = true;
        homeData.nextGig = {};
        homeData.nextGig.title = data[0].title;
        homeData.nextGig.date = data[0].date;
        homeData.nextGig.startTime = data[0].startTime;
        homeData.nextGig.desc = converter.makeHtml(data[0].desc);
        homeData.nextGig.venue = db.venue[data[0].venue];
    }
    if (data.length > 1) {
        homeData.moreGigs = {};
        homeData.moreGigs.text = "More Upcoming Shows";
        homeData.moreGigs.url = "/gig?range=upcoming";
    }
    if (data.length < totalGigs) {
        homeData.pastGigs = {};
        homeData.pastGigs.text = "Previous Shows";
        homeData.pastGigs.url = "/gig?range=past";
    }

    // releases
    data = main.objToArray(db.release).sort(main.sortByDateDesc);
    if (data.length > 0) {
        homeData.latestRelease = {};
        homeData.latestRelease.name = data[0].name || db.song[data[0].songs[0]].name;
        homeData.latestRelease.date = data[0].date;
        homeData.latestRelease.frontCover = data[0]["cover-front"];
        homeData.latestRelease.desc = converter.makeHtml(data[0].desc);
        homeData.latestRelease.spotifyUrl = data[0].audio.spotify || db.song[data[0].songs[0]].audio.spotify;
    }
    if (data.length > 1) {
        homeData.moreReleases = true;
    }

    if (main.objToArray(db.song).length > 0) {
        homeData.hasSongs = true;
    }

    // about
    if (db.band.desc) {
        homeData.bandDesc = converter.makeHtml(db.band.desc);
    }
    if (db.band.bio || db.band.contact) {
        homeData.hasAbout = true;
    }

    // social links
    // data = main.objToArray(db.band.social);
    var socialNames = {
        "fb": "Facebook",
        "spotify": "Spotify",
        "instagram": "Instagram",
        "youtube": "YouTube",
        "podcast": "Podcast"
    };
    homeData.social = [];
    Object.keys(db.band.social).forEach(s => {
        if (db.band.social[s]) {
            homeData.social.push({"text": socialNames[s], "url": db.band.social[s]});
        }
    });
    return homeData;
}

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
    var setupToken = qs["setup-token"] || "";
    // rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.start, {"setup-token": setupToken}, db, API_DIR));
};

this.get = function (req, rsp, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'application/json') {
        return siteData(rsp, db);
    }
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.site, single(db), db));
};

this.home = function (req, rsp, db) {
    if (req.headers.accept === 'application/json') {
        rsp.writeHead(200, {'Content-Type': 'application/json'});
        return rsp.end("{}");
    }
    if (main.isLoggedIn(req, db.user)) {
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.home, db.band, db));
    } else {
        rsp.writeHead(200, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.homeNoAuth, homeNoAuth(db), db));
    }
    return;
};

async function loadData() {
    template.site = await fs.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.start = await fs.readFile(`${__dirname}/start.html.mustache`, 'utf8');

    template.home = await fs.readFile(`${__dirname}/index.html.mustache`, 'utf8');
    template.homeNoAuth = await fs.readFile(`${__dirname}/index-noauth.html.mustache`, 'utf8');
}

loadData();
