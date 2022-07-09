const fs = require("fs").promises;
const https = require('https');
const showdown  = require('showdown');
const converter = new showdown.Converter({"noHeaderId": true, "simpleLineBreaks": true});
const main = require('../../inc/main.js');

const resourceName = 'style';
const template = {};
var webFonts = [];

function getGoogleFontName(fontFile) {
    var fontName = "";
    var fontVariant = "";

    webFonts.forEach(font => {
        // console.log(font.family);
        font.files.forEach(file => {
            if (file.file === fontFile) {
                fontName = font.family;
                fontVariant = file.variant;
            }
        });
    });
    return `${fontName} ${fontVariant}`;
}

async function getWebFonts(req) {
    const options = {
        hostname: "www.googleapis.com",
        path: `/webfonts/v1/webfonts?key=${process.env.MAP_KEY || ""}`,
        method: "GET",
        headers: {
            Accept: 'application/json',
            referer: req.headers.host
        }
    };
    // console.log(options);

    let p = new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            // res.setEncoding('utf8');
            var responseBody = '';
            var statusCode = res.statusCode;

            res.on('data', (chunk) => {
                responseBody += chunk;
            });

            res.on('end', () => {
                if (statusCode >= 200 && statusCode < 400) {
                    // console.log(responseBody.slice(0, 64));
                    // console.log(statusCode);
                    var jsonFonts = JSON.parse(responseBody);
                    jsonFonts.items.forEach(font => {

                        webFonts.push({
                            "family": font.family,
                            "files": Object.keys(font.files).map(variant => {
                                return {
                                    "variant": variant,
                                    "file": font.files[variant],
                                };
                            }),
                            "category": font.category,
                            "no-variants": font.variants.length === 1
                        });
                    });
                    resolve(webFonts);
                } else {
                    // console.error(responseBody);
                    resolve([]);
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        // req.write(data);
        req.end();
    });

    return await p;
}

function tableList(items) {
    if (!items) {
        items = [];
    }
    return items.map((s, i) => {
        return {
            "reorder-value": s,
            "index": i,
            "index-up": i - 1,
            "index-down": i + 1,
            "index-top": i === 0,
            "index-bottom": i >= items.length - 1
        };
    });
}

function fontList(items) {
    if (!items) {
        items = [];
    }
    return items.map((s, i) => {
        return {
            "reorder-value": s.file,
            "font-name": s.name,
            "index": i,
            "index-up": i - 1,
            "index-down": i + 1,
            "index-top": i === 0,
            "index-bottom": i >= items.length - 1
        };
    });
}

function single(req, db, msg, error) {
    // if (req && webFonts.length === 0) {
    //     webFonts = await getWebFonts(req);
    // }
    var resourceData = Object.assign({
        "resourceName": resourceName,
        "logo1-photos": main.displayPhotos(db.photo, db[resourceName].logo1),
        "logo1-no-photo": main.noPhotoSelected(db[resourceName].logo1),
        "logo2-photos": main.displayPhotos(db.photo, db[resourceName].logo2),
        "logo2-no-photo": main.noPhotoSelected(db[resourceName].logo2),
        "logo3-photos": main.displayPhotos(db.photo, db[resourceName].logo3),
        "logo3-no-photo": main.noPhotoSelected(db[resourceName].logo3),
        "hasUploadedFonts": db.font.length > 0,
        "uploadedFonts": db.font.map(f => {
            return {
                "file": f,
                "name": f.slice(0, f.lastIndexOf("."))
            };
        }),
        "colorList": tableList(db[resourceName].colors),
        "fontList": fontList(db[resourceName].fonts),
        "webFonts": webFonts
    }, db[resourceName]);
    // console.log(resourceData);
    return Object.assign(main.addMessages(msg, error), resourceData);
}

function hasLogo(styleData) {
    return (styleData.logoRules || styleData.logo1 || styleData.logo2 || styleData.logo3);
}

function getCustomFonts(db) {
    return db[resourceName].fonts.map(f => {
        return {
            "name": f.name,
            "file": f.type === "uploaded" ? `/photo/${f.file}` : f.file
        };
    });
}

function singleNoAuth(db, msg, error) {
    // console.log('hasLogo(db[resourceName])');
    // console.log(hasLogo(db[resourceName]));
    var resourceData = Object.assign({
        "resourceName": resourceName,
        "logoRulesHtml": converter.makeHtml(db[resourceName].logoRules),
        "toneHtml": converter.makeHtml(db[resourceName].tone),
        "hasLogo": hasLogo(db[resourceName]),
        "colorInfo": db[resourceName].colors.map(c => {
            var rgb = main.hexToRgb(c);
            return {"hex": c.slice(1), "rgb": rgb, "cmyk": main.rgbToCmyk(rgb)};
        }),
        "customFonts": getCustomFonts(db)
    }, db[resourceName]);

    return Object.assign(main.addMessages(msg, error), resourceData);
}

function singleData(db) {
    return Object.assign({
        "resourceName": resourceName,
    }, db[resourceName]);
}

function isUpdateInvalid(body) {
    var msg = [];

    if (body.logoRules.length > 3000) {
        msg.push('Logo text too long.');
    }

    return msg;
}

function isColorInvalid(body) {
    var msg = [];

    if (!body.color && !body.font) {
        msg.push('Color or font is required.');
    }

    if (body.color) {
        if (!/^#[0-9A-F]{6}$/i.test(body.color)) {
            msg.push('Invalid hex color.');
        }
    }

    // if (body.font) {
        //
    // }

    return msg;
}

this.addColorOrFont = function (req, rsp, body, db, save) {
    var error;
    error = isColorInvalid(body);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single("", db, "", error), db));
        return;
    }

    if (!db.style.colors) {
        db.style.colors = [];
    }
    if (body.color) {
        db.style.colors.push(body.color);
    }

    if (!db.style.fonts) {
        db.style.fonts = [];
    }
    var fontType;
    var fontName;
    var fontFile;
    if (body.font) {
        fontFile = body.font.split("|")[0];
        fontType = body.font.split("|")[1];
        if (fontType !== "uploaded" && fontType !== "google") {
            rsp.writeHead(400, {'Content-Type': 'text/html'});
            rsp.end(main.renderPage(req, template.single, single("", db, "", "Invalid font type"), db));
            return;
        }
        if (fontType === "uploaded") {
            fontName = fontFile.slice(0, fontFile.lastIndexOf("."));
        } else {
            fontName = getGoogleFontName(fontFile);
        }
        db.style.fonts.push({
            "name": fontName,
            "file": fontFile,
            "type": fontType
        });
    }
    save();

    var returnData = main.responseData("", resourceName, db, "Added");

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single("", db, [`${resourceName} color added.`]), db));
};

this.reorderColorOrFont = function (req, rsp, body, db, save) {
    var currentIndex;
    var newIndex;
    var colorValue;
    var returnData;

    if (body.array !== "fonts" && body.array !== "colors") {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single("", db, "", "Invalid array"), db));
        return;
    }
    if (body.array === "fonts") {
        currentIndex = db.style.fonts.findIndex(f => body['reorder-value'] === f.file);
    } else {
        currentIndex = db.style.colors.indexOf(body['reorder-value']);
    }

    if (currentIndex === -1) {
        rsp.writeHead(404, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single("", db, "", "Value not found"), db));
        return;
    }
    newIndex = body.index;
    if (newIndex >= db.style[body.array].length) {
        newIndex = db.style[body.array].length - 1;
    }
    colorValue = db.style[body.array].splice(currentIndex, 1);
    if (parseInt(newIndex) > -1) {
        db.style[body.array].splice(newIndex, 0, colorValue[0]);
    }

    save();

    returnData = main.responseData("", resourceName, db, "Updated");

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single("", db, [`${resourceName} ${body.array} updated.`]), db));
};

function updateResource(body, db, save) {
    db[resourceName].logoRules = body.logoRules;
    db[resourceName].logo1 = body.logo1;
    db[resourceName].logo2 = body.logo2;
    db[resourceName].logo3 = body.logo3;

    db[resourceName].font1 = body.font1;
    db[resourceName].font2 = body.font2;
    db[resourceName].font3 = body.font3;
    db[resourceName].fontMonospace = body.fontMonospace;

    db[resourceName].tone = body.tone;

    save();
}

this.update = function (req, rsp, formData, db, save) {
    var error = isUpdateInvalid(formData);
    if (error.length) {
        rsp.writeHead(400, {'Content-Type': 'text/html'});
        rsp.end(main.renderPage(req, template.single, single("", db, "", error), db));
        return;
    }

    updateResource(formData, db, save);

    var returnData = main.responseData("", resourceName, db, "Updated", ["Style information updated."]);

    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, returnData);
    }

    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, single("", db, [`${resourceName} updated.`]), db));
};

this.get = async function (req, rsp, db) {
    if (webFonts.length === 0) {
        webFonts = await getWebFonts(req);
    }
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'application/json') {
        return main.returnJson(rsp, singleData(db));
    }
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    if (main.isLoggedIn(req, db.user)) {
        var singleDataTest = single(req, db);
        rsp.end(main.renderPage(req, template.single, singleDataTest, db));
    } else {
        rsp.end(main.renderPage(req, template.singleNoAuth, singleNoAuth(db), db));
    }
};

async function loadData() {
    template.single = await fs.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.singleNoAuth = await fs.readFile(`${__dirname}/${resourceName}-noauth.html.mustache`, 'utf8');
}

loadData();
