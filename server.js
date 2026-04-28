const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const portArg = Number(process.argv[2]);
let port = Number.isFinite(portArg) && portArg > 0 ? portArg : 5173;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  if (!targetPath.startsWith(base)) return null;
  return targetPath;
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, { "Cache-Control": "no-store", ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    let pathname = decodeURIComponent(url.pathname || "/");
    if (pathname === "/") pathname = "/index.html";

    const filePath = safeJoin(root, pathname.replace(/^\//, ""));
    if (!filePath) return send(res, 403, "Forbidden");

    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) return send(res, 404, "Not Found");
      const ext = path.extname(filePath).toLowerCase();
      const type = mime[ext] || "application/octet-stream";

      res.writeHead(200, {
        "Content-Type": type,
        "Cache-Control": "no-store",
      });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (e) {
    send(res, 500, "Internal Server Error");
  }
});

function listen(p) {
  server.listen(p, "127.0.0.1", () => {
    console.log(`SaaSManager local server: http://127.0.0.1:${p}/index.html`);
  });
}

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    port += 1;
    listen(port);
    return;
  }
  console.error(err);
  process.exit(1);
});

listen(port);
