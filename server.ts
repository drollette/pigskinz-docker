// Custom server: something has to own the raw HTTP server so it can
// intercept WebSocket upgrade requests on /api/ws before handing everything
// else to Next's request handler -- the same interception this app's
// Cloudflare original did in worker.ts, one runtime down. Also starts the
// cron loop (see src/cron/index.ts) in the same process, since this is a
// single-container deployment with no separate scheduler.
//
// Run directly with tsx (see package.json's "start" script) rather than
// compiled ahead of time -- this file and its cron/realtime imports sit
// outside Next's own build (which only compiles the app router tree), so
// something has to handle their TypeScript at runtime. The overhead is
// negligible for a long-lived server process that isn't Next's own request
// handling (that part still goes through Next's own compiled output).
import { createServer, type IncomingMessage } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, type WebSocket } from "ws";
import { attachLockerRoom } from "./src/realtime/locker-room";
import { startCronLoop } from "./src/cron";

const port = parseInt(process.env.PORT ?? "3000", 10);
const app = next({ dev: process.env.NODE_ENV !== "production" });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res, parse(req.url!, true)));

  const wss = new WebSocketServer({ noServer: true });
  attachLockerRoom(wss);

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const { pathname } = parse(req.url!);
    if (pathname === "/api/ws") {
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => wss.emit("connection", ws, req));
    } else {
      socket.destroy();
    }
  });

  startCronLoop();

  server.listen(port, () => {
    console.log(`Ready on http://localhost:${port}`);
  });
});
