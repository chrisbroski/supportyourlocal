const main = require('../../inc/main.js');

function htmlEsc(str) {
    return str.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
        return '&#' + i.charCodeAt(0) + ';';
    });
}

function attrEsc(str) {
    return str.replace('"', '&quot;');
}

function parsePath(ref, qs) {
    var splitted;
    var parsed;
    var results = {};
    if (!ref) {
        return results;
    }
    splitted = ref.split(" ");
    if (splitted.length < 3) {
        return results;
    }
    results.path = splitted[1];
    parsed = main.getPath(process.env.SUBDIR + results.path);
    results.page = parsed.resource;
    results.id = "";
    if (parsed.qs) {
        results.id = parsed.qs.id || "";
    }
    results.resource = qs.resource || "";
    if (!results.resource) {
        results.resource = results.page;
    }
    results.name = qs.name || "";
    if (!results.name) {
        results.name = "name";
    }
    return results;
}

this.get = function (req, rsp, db, qs, cssMainVer) {
    var protocol = (process.env.DEV === "Y") ? "http://" : "https://";
    var metaData = [];
    var server = req.headers.host;
    var request = parsePath(req.headers.referrer, qs);
    var title = [];
    title.push(htmlEsc(db.band.name));
    if (request.page) {
        title.unshift(main.toTitleCase(request.page));
    }

    var item = "";
    if (request.id) {
        if (db[request.resource] && db[request.resource][request.name]) {
            item = db[request.resource][request.name]; // get id name
            title.unshift(item);
        }
    }
    metaData.push(`<title>${title.join(" - ")}</title>`);
    if (db.band.desc) {
        metaData.push(`<meta name="description" content="${attrEsc(db.band.desc)}">`);
        metaData.push(`<meta property="og:description" content="${attrEsc(db.band.desc)}" />`);
    }
    metaData.push(`<link rel="stylesheet" href="/inc/main.css?v=${cssMainVer}">`);
    metaData.push('<link rel="icon" href="/favicon.ico">');
    if (db.site.thumbnail) {
        metaData.push(`<meta property="og:image" content="${protocol}${server}/photo/${db.site.thumbnail}" />`);
    }
    metaData.push(`<meta property="og:url" content="${protocol}${server}${request.path}" />`);
    metaData.push('<meta property="og:type" content="website" />');
    metaData.push(`<meta property="og:title" content="${title.join(" - ")}" />`);
    rsp.writeHead(200, {'Content-Type': 'text/pht'});
    rsp.end(metaData.join("\n"));
    return;
};
