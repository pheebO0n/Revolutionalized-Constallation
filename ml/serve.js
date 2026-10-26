// Tiny static server for the viewer (static deploy is the real target).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { NL } = require('./nl.js');

const root = path.join(__dirname, '..', 'public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const port = parseInt(process.env.PORT || '8080', 10);

http.createServer((req, res) => {
 let p = decodeURIComponent(req.url.split('?')[0]);
 if (p === '/') p = '/index.html';
 const safe = p.split('..').join('');
 const file = path.join(root, safe);
 fs.readFile(file, (err, buf) => {
 if (err) { res.writeHead(404); res.end('not found'); return; }
 res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
 res.end(buf);
 });
}).listen(port, () => console.log('zames viewer on http://localhost:' + port));
