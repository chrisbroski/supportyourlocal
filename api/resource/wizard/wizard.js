const fs = require("fs").promises;
const showdown  = require('showdown');
const converter = new showdown.Converter({"noHeaderId": true, "simpleLineBreaks": true});

// Custom libs
const main = require('../../inc/main.js');
const resourceName = 'wizard';
const template = {};

function pressList(press) {
    if (!press) {
        return [];
    }
    return press.map((s, i) => {
        return {
            "press-url": s.url,
            "press-headline": s.headline,
            "press-index": i,
            "index-up": i - 1,
            "index-down": i + 1,
            "index-top": i === 0,
            "index-bottom": i >= press.length - 1
        };
    });
}

function single(db, msg, error) {
    var resourceData = Object.assign({
        "resourceName": resourceName,
        "pageName": 'Band Info',
        "countries": main.country(db[resourceName].country) || "US",
        "unselected-photos": main.displayMultiPhoto(db.photo, db[resourceName].promos),
        "promo-photos": main.displayMultiPhoto2(db[resourceName].promos, db),
        "hasPhotos": db[resourceName].promos && db[resourceName].promos.length > 0,
        "pressList": pressList(db[resourceName].press),
        "hasPress": db[resourceName].press && db[resourceName].press.length > 0
    }, db[resourceName]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function singleNoAuth(db) {
    const members = [];
    Object.keys(db.user).forEach(u => {
        var memberData = {};
        var nameSeparator;
        var locSeparator;
        if (db.user[u].bandMember === "Y" && db.user[u].bio) {
            nameSeparator = (db.user[u].givenName && db.user[u].surname) ? " " : "";
            memberData.name = `${db.user[u].givenName}${nameSeparator}${db.user[u].surname}`;
            locSeparator = (db.user[u].city && db.user[u].state) ? ", " : "";
            memberData.location = `${db.user[u].city}${locSeparator}${db.user[u].state}`;
            memberData.bioHtml = converter.makeHtml(db.user[u].bio);
            if (db.photo[db.user[u].photo].web) {
                memberData.photo = `${db.photo[db.user[u].photo].name}_web${db.photo[db.user[u].photo].ext}`;
            } else {
                memberData.photo = db.user[u].photo;
            }
            members.push(memberData);
        }
    });

    var socials = {};
    if (db.band.social) {
        socials = db.band.social;
    }
    var payments = {};
    if (db.band.payment) {
        payments = db.band.payment;
    }
    var resourceData = Object.assign({
        "resourceName": resourceName,
        "pageName": 'About',
        "descHtml": converter.makeHtml(db.band.desc),
        "bioHtml": converter.makeHtml(db.band.bio),
        "contactHtml": converter.makeHtml(db.band.contact),
        "promo-photos": main.displayMultiPhoto2(db[resourceName].promos, db),
        "hasPhotos": db[resourceName].promos && db[resourceName].promos.length > 0,
        "pressList": db[resourceName].press,
        "hasPress": db[resourceName].press && db[resourceName].press.length > 0,
        "members": members
    }, db[resourceName]);

    return resourceData;
}

function contentExists(db) {
    var upcomingGigs = main.countGigs(db, "upcoming");
    var hasUpcomingGigs = upcomingGigs > 0;
    var hasPastGigs = (main.countGigs(db, "past") > 0 && upcomingGigs === 0);
    var hasReleases = Object.keys(db.release).length > 0;
    var hasSongs = Object.keys(db.song).length > 0;
    var hasAbout = main.hasAbout(db);
    var hasSupport = main.hasSupport(db);

    return {
        "upcomingGigs": hasUpcomingGigs,
        "pastGigs": hasPastGigs,
        "releases": hasReleases,
        "songs": hasSongs,
        "about": hasAbout,
        "support": hasSupport
    };
}

function isPressInvalid(formData) {
    var msg = [];

    if (!formData['press-url']) {
        msg.push('Press URL is required.');
    }

    if (!formData.headline) {
        msg.push('Press headline is required.');
    }

    return msg;
}

function isPhotoInvalid(formData) {
    var msg = [];

    if (!formData.promo) {
        msg.push('Photo is required.');
    }

    return msg;
}

this.addPressOrPhoto = function (req, rsp, formData, db, save) {
    if (formData['press-url']) {
        return addPress(req, rsp, formData, db, save);
    }
    return addPhoto(req, rsp, formData, db, save);
};

function addPress(req, rsp, formData, db, save) {
    var error = isPressInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, "", error), db));
        return;
    }
    if (!db[resourceName].press) {
        db[resourceName].press = [];
    }
    db[resourceName].press.unshift({
        "url": formData['press-url'],
        "headline": formData.headline
    });
    save();

    rsp.writeHead(201, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, ["Press added"]), db));
}

function addPhoto(req, rsp, formData, db, save) {
    var error = isPhotoInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, "", error), db));
        return;
    }
    if (!db[resourceName].promos) {
        db[resourceName].promos = [];
    }
    db[resourceName].promos.push(formData.promo);
    save();

    rsp.writeHead(201, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, ["Promo photo added"]), db));
}

this.reorderPressOrPhoto = function (req, rsp, formData, db, save) {
    if (formData.array === "press") {
        return reorderPress(req, rsp, formData, db, save);
    }
    return reorderPhoto(req, rsp, formData, db, save);
};

function reorderPress(req, rsp, body, db, save) {
    var currentIndex;
    var newIndex;
    var pressValue;
    var returnData;

    currentIndex = body['press-index'];

    if (currentIndex < 0 || currentIndex >= db.band.press.length) {
        rsp.writeHead(404, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, "", "Value not found"), db));
        return;
    }
    newIndex = body.index;
    if (newIndex >= db.band.press.length) {
        newIndex = db.band.press.length - 1;
    }
    pressValue = db.band.press.splice(currentIndex, 1);
    if (parseInt(newIndex) > -1) {
        db.band.press.splice(newIndex, 0, pressValue[0]);
    }

    save();

    returnData = main.responseData("", resourceName, db, "Updated");

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, [`Press coverage updated.`]), db));
}

function reorderPhoto(req, rsp, body, db, save) {
    var currentIndex;
    var newIndex;
    var photoValue;
    var returnData;

    currentIndex = db.band.promos.indexOf(body.promo);

    if (currentIndex < 0 || currentIndex >= db.band.promos.length) {
        rsp.writeHead(404, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, "", "Value not found"), db));
        return;
    }
    if (body.move_right) {
        newIndex = currentIndex + 1;
        if (newIndex >= db.band.promos.length) {
            newIndex = 0;
        }
    } else if (body.move_left) {
        newIndex = currentIndex - 1;
        if (newIndex < 0) {
            newIndex = db.band.promos.length;
        }
    }

    photoValue = db.band.promos.splice(currentIndex, 1);
    if (!body.remove) {
        db.band.promos.splice(newIndex, 0, body.promo);
    }

    save();

    returnData = main.responseData("", resourceName, db, "Updated");

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    // Move selected with photos
    rsp.end(main.renderPage(req, template.single, single(db, [`Promo photo order updated.`]), db));
}

function isUpdateInvalid(body) {
    var msg = [];

    if (!body.name) {
        msg.push('Band name is required.');
    }

    return msg;
}

function updateResource(body, db, save) {
    db[resourceName].name = body.name;
    db[resourceName].desc = body.desc;

    db[resourceName].bio = body.bio;
    db[resourceName].contact = body.contact;

    db[resourceName].city = body.city;
    db[resourceName].state = body.state;
    db[resourceName].country = body.country;

    db[resourceName].genre1 = body.genre1;
    db[resourceName].genre2 = body.genre2;
    db[resourceName].genre3 = body.genre3;

    if (!db[resourceName].social) {
        db[resourceName].social = {};
    }
    db[resourceName].social.spotify = body["social-spotify"];
    db[resourceName].social.apple = body["social-apple"];
    db[resourceName].social.youtubemusic = body["social-youtubemusic"];
    db[resourceName].social.amazon = body["social-amazon"];
    db[resourceName].social.deezer = body["social-deezer"];
    db[resourceName].social.bandcamp = body["social-bandcamp"];
    db[resourceName].social.soundcloud = body["social-soundcloud"];

    db[resourceName].social.fb = body["social-fb"];
    db[resourceName].social.instagram = body["social-instagram"];
    db[resourceName].social.youtube = body["social-youtube"];
    db[resourceName].social.tiktok = body["social-tiktok"];
    db[resourceName].social.podcast = body["social-podcast"];

    if (!db[resourceName].payment) {
        db[resourceName].payment = {};
    }
    db[resourceName].payment.venmo = body["pay-venmo"];

    save();
}

this.update = function (req, rsp, formData, db, save) {
    var error = isUpdateInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single(db, [`${resourceName} updated.`]), db));
        return;
    }

    updateResource(formData, db, save);

    var returnData = main.responseData("", resourceName, db, "Updated", ["Band information updated."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    // returnData.back = req.headers.referer;
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single(db, [`${resourceName} updated.`]), db, process.env.SUBDIR));
};

this.get = function (req, rsp, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, Object.assign(contentExists(db), db.band));
    }
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    if (main.isLoggedIn(req, db.user)) {
        rsp.end(main.renderPage(req, template.single, single(db), db));
    } else {
        rsp.end(main.renderPage(req, template.singleNoAuth, singleNoAuth(db), db));
    }
};

async function loadData() {
    template.single = await fs.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.singleNoAuth = await fs.readFile(`${__dirname}/${resourceName}-noauth.html.mustache`, 'utf8');
}

loadData();
