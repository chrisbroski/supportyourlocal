const fs = require("fs").promises;
const showdown  = require('showdown');
const converter = new showdown.Converter({"noHeaderId": true, "simpleLineBreaks": true});
const main = require('../../inc/main.js');

const resourceName = 'site';
const template = {};
var tzOffset = -4; // -4:00 for EDT;

function timestampToday() {
    var today = new Date();
    today.setHours(tzOffset, 0, 0, 0);
    return +today;
}

function canBeShown(release, targetTimestamp) {
    var startShowingOn = new Date(release.date);
    startShowingOn.setHours(24 + tzOffset, 0, 0, 0);
    var promoDate;

    // If a promotionStart date is present
    if (release.promotionStart) {
        promoDate = new Date(release.promotionStart);
        promoDate.setHours(24 + tzOffset, 0, 0, 0);
        // And promotionStart is sooner than the release date
        if (+promoDate < +startShowingOn) {
            startShowingOn = promoDate;
        }
    }
    return +startShowingOn - targetTimestamp <= 0;
}

function releaseAfterThis(r) {
    return canBeShown(r, this);
}

function fontList(fonts, selected) {
    return fonts.map(f => {
        return {
            "name": f.name,
            "file": f.file,
            "selected": selected === f.file ? ' selected="selected"' : ""
        };
    });
}

function displayColors(colors, selected) {
    var colorData = [];
    var selectedIdx;
    var selectedColor;
    colors.forEach((c, idx) => {
        var sel = '';
        if (selected === c) {
            sel = ' checked="checked"';
            selectedIdx = idx;
        }
        colorData.push({
            "colorHex": c,
            "selected": sel
        });
    });
    if (selectedIdx) {
        selectedColor = colorData.splice(selectedIdx, 1);
        colorData.unshift(selectedColor[0]);
    }
    return colorData;
}

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
        "colors1": displayColors(db.style.colors, db[resourceName].color1),
        "no-color1": main.noPhotoSelected(db[resourceName].color1),
        "colors2": displayColors(db.style.colors, db[resourceName].color2),
        "no-color2": main.noPhotoSelected(db[resourceName].color2),
        "headerFonts": fontList(db.style.fonts, db.site["header-font"]),
        "header-font-normal": headerFontNormal,
        "header-sans-serif-selected": db.site["header-font-default"] === "sans-serif" ? ' selected="selected"' : '',
        "header-serif-selected": db.site["header-font-default"] === "serif" ? ' selected="selected"' : '',
        "header-monospace-selected": db.site["header-font-default"] === "monospace" ? ' selected="selected"' : '',
        "header-cursive-selected": db.site["header-font-default"] === "cursive" ? ' selected="selected"' : '',
        "header-fantasy-selected": db.site["header-font-default"] === "fantasy" ? ' selected="selected"' : '',
        "bodyFonts": fontList(db.style.fonts, db.site["body-font"]),
        "header-font-bold": headerFontBold,
        "body-sans-serif-selected": db.site["body-font-default"] === "sans-serif" ? ' selected="selected"' : '',
        "body-serif-selected": db.site["body-font-default"] === "serif" ? ' selected="selected"' : '',
        "body-monospace-selected": db.site["body-font-default"] === "monospace" ? ' selected="selected"' : '',
        "body-cursive-selected": db.site["body-font-default"] === "cursive" ? ' selected="selected"' : '',
        "body-fantasy-selected": db.site["body-font-default"] === "fantasy" ? ' selected="selected"' : '',
        "bg-photos": main.displayPhotos(db.photo, db[resourceName].background),
        "bg-no-photo": main.noPhotoSelected(db[resourceName].background),
        "thumb-photos": main.displayPhotos(db.photo, db[resourceName].thumbnail),
        "thumb-no-photo": main.noPhotoSelected(db[resourceName].thumbnail)
    }, db[resourceName]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function siteData(rsp, db) {
    var jsonSite = {
        "site": db.site,
        "band": db.band
    };
    if (!jsonSite.site.color1) {
        jsonSite.site.color1 = "#000000";
    }
    if (!jsonSite.site.color2) {
        jsonSite.site.color2 = "#000000";
    }
    main.returnJson(rsp, jsonSite);
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

function isUpdateInvalid() {
    var msg = [];

    // if (!body.color1) {
    //     msg.push('Primary color is required.');
    // }
    // if (!body.color2) {
    //     msg.push('Secondary color is required.');
    // }

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

this.setup = function (req, rsp, formData, db, save, setupToken) {
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

    var returnData = main.responseData("", resourceName, db, "Updated", ["Site setup complete."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(303, {'Content-Type': 'text/plain', "Location": `${process.env.SUBDIR}/login`});
    rsp.end("Site setup complete.");
};

this.update = function (req, rsp, formData, db, save) {
    var error = isUpdateInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, "", error), db));
        return;
    }

    updateResource(formData, db, save);

    var returnData = main.responseData("", resourceName, db, "Updated", ["Band information updated."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.site, single(db, [`${resourceName} updated.`]), db));
};

function getFontData(style, file) {
    var fontData;
    if (!style.fonts) {
        return;
    }
    style.fonts.forEach(f => {
        if (f.file === file) {
            fontData = f;
        }
    });
    return fontData;
}

function getCustomCSS(db) {
    var color1 = main.hexToRgb(db.site.color1 || '#000000');
    var color2 = main.hexToRgb(db.site.color2 || '#000000');
    var headerFontData = getFontData(db.style, db.site["header-font"]);
    var bodyFontData = getFontData(db.style, db.site["body-font"]);
    var headerFont = "sans-serif";
    var bodyFont = "serif";
    var fontImport = "";
    var fontWeight = "normal";
    var backgroundImage = db.site.background || "";
    var path = "";

    if (db.site["header-font-default"]) {
        headerFont = db.site["header-font-default"];
    }
    if (headerFontData) {
        if (headerFontData.type === "uploaded") {
            path = "/photo/";
        }

        fontImport = `@font-face {
    font-family: "${headerFontData.name}";
    src: url("${path}${headerFontData.file}");
}

`;
        headerFont = `'${headerFontData.name}', ${headerFont}`;
    }
    if (db.site["body-font-default"]) {
        bodyFont = db.site["body-font-default"];
    }

    path = "";
    if (bodyFontData) {
        if (bodyFontData.type === "uploaded") {
            path = "/photo/";
        }

        fontImport += `@font-face {
    font-family: "${bodyFontData.name}";
    src: url("${path}${bodyFontData.file}");
}

`;
        bodyFont = `'${bodyFontData.name}', ${bodyFont}`;
    }

    if (db.site["header-font-weight"]) {
        fontWeight = db.site["header-font-weight"];
    }

    if (backgroundImage) {
        backgroundImage = `url('/photo/${backgroundImage}')`;
    }

    return `${fontImport}:root {
    --color1: ${color1.r}, ${color1.g}, ${color1.b};
    --color2: ${color2.r}, ${color2.g}, ${color2.b};
    --header-font: ${headerFont};
    --header-font-weight: ${fontWeight};
    --body-font: ${bodyFont};
    --background-image: ${backgroundImage};
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

function getAnnouncementSong(songId, db) {
    var audio = db.song[songId].media.filter(m => {
        return m.type === "audio";
    });
    return audio[0].url;
}

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
                announcement.songLink.url = getAnnouncementSong(db.announcement[id].song, db);
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
    // Filter out future releases if promotionStart after today
    // var releases = main.objToArray(db[resourceName]).sort(main.sortByDateDesc);
    var tsToday = timestampToday();

    data = data.filter(releaseAfterThis, tsToday);
    data = data.map(r => {
        var releaseDate = new Date(r.date);
        releaseDate.setHours(24 + tzOffset, 0, 0, 0);
        if (+releaseDate - tsToday >= 0) {
            r.upcomingRelease = true;
            r["cover-back"] = "";
            r.credits = "";
            r.audio = {};
            r.video = {};
            r.songs.length = 0;
        }
        return r;
    });

    if (data.length > 0) {
        homeData.latestRelease = {};
        if (data[0].upcomingRelease) {
            homeData.releaseTitle = "Next Release";
        } else {
            homeData.releaseTitle = "Latest Release";
        }
        homeData.upcomingRelease = data[0].upcomingRelease;
        homeData.latestRelease.id = data[0].id;
        homeData.latestRelease.name = data[0].name || db.song[data[0].songs[0]].name;
        homeData.latestRelease.date = data[0].date;
        homeData.latestRelease.frontCover = main.photoWeb(db, data[0]["cover-front"]);
        homeData.latestRelease.desc = converter.makeHtml(data[0].desc);
        homeData.latestRelease.spotifyUrl = "";
        if (data[0].audio) {
            if (data[0].audio.spotify) {
                homeData.latestRelease.spotifyUrl = data[0].audio.spotify;
            } else {
                if (data[0].songs.length) {
                    homeData.latestRelease.spotifyUrl = main.songLink(db, data[0].id);
                }
            }
        }
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
    if (main.hasSupport(db)) {
        homeData.hasSupport = true;
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

this.getCss = function (req, rsp, db, isCss) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'text/css' || isCss) {
        rsp.writeHead(200, {'Content-Type': 'text/css'});
        rsp.end(getCustomCSS(db));
        return;
    }
    return main.returnJson(rsp, db[resourceName]);
};

this.start = function (req, rsp, db, qs) {
    var setupToken;
    if (qs) {
        setupToken = qs["setup-token"] || "";
    } else {
        setupToken = "";
    }
    // rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.start, {"setup-token": setupToken}, db));
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
