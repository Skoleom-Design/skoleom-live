// Serveur Next personnalise pour la prod (start:web) — uniquement necessaire pour proxier les
// upgrades WebSocket de Socket.IO. Les rewrites de next.config.js gerent deja /api, /uploads et
// /static en HTTP classique, mais Next ne proxie pas les upgrades WebSocket via `rewrites()`
// (verifie empiriquement : timeout systematique, en dev comme en prod) — d'ou ce petit serveur
// qui intercepte l'evenement 'upgrade' pour /socket.io/* et le relaie vers Nest en interne.
const { createServer } = require('http');
const next = require('next');
const httpProxy = require('http-proxy');

const port = parseInt(process.env.PORT || '3000', 10);
const apiUrl = process.env.API_URL || 'http://localhost:3000';
const dev = process.env.NODE_ENV !== 'production';

const app = next({ dev });
const handle = app.getRequestHandler();
const proxy = httpProxy.createProxyServer({ ws: true });

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));

  server.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith('/socket.io')) {
      proxy.ws(req, socket, head, { target: apiUrl });
    } else {
      socket.destroy();
    }
  });

  server.listen(port, () => {
    console.log(`Next custom server ready on :${port}`);
  });
});
