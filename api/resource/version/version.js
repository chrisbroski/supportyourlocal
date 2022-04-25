const fs = require("fs").promises;
const showdown  = require('showdown');
const converter = new showdown.Converter({"noHeaderId": true, "simpleLineBreaks": true});

// Custom libs
const main = require('../../inc/main.js');
const resourceName = 'version';
const template = {};

this.get = function (req, rsp, db) {
    rsp.setHeader('Cache-Control', 'max-age=0,no-cache,no-store,post-check=0,pre-check=0');
    if (req.headers.accept === 'text/plain') {
        rsp.writeHead(200, {'Content-Type': 'text/plain'});
        rsp.end(template.version);
        return;
    }
    rsp.writeHead(200, {'Content-Type': 'text/html'});
    rsp.end(main.renderPage(req, template.single, {
        "markdown": converter.makeHtml(template.version)
    }, db));
};

async function loadData() {
    template.single = await fs.readFile(`${__dirname}/${resourceName}.html.mustache`, 'utf8');
    template.version = await fs.readFile(`${__dirname}/../../../release.md`, 'utf8');
}

loadData();
