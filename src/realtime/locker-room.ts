// Replaces the Cloudflare GameRoom Durable Object this app was ported from.
// A Durable Object is, functionally, a single-threaded actor holding a Map
// of live sessions in memory, addressed consistently by idFromName(). In a
// single Node process there's only ever one instance of this module anyway,
// so a module-level Map reproduces the same guarantee for free -- and the
// old server-to-DO "POST /broadcast" HTTP hop collapses into a direct
// function call.
import type { WebSocket, WebSocketServer } from "ws";
import { randomUUID } from "crypto";

interface Session {
  id: string;
  ws: WebSocket;
  userId?: string;
  gameId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RoomMessage = Record<string, any> & { type: string };

const sessions = new Map<string, Session>();

function send(session: Session, message: RoomMessage) {
  try {
    session.ws.send(JSON.stringify(message));
  } catch {
    sessions.delete(session.id);
  }
}

/** Broadcasts to every connected client except `excludeSessionId`, if given.
 * Used both for score/pick updates and Locker Room chat -- see
 * broadcastToLockerRoom below and src/app/locker-room/actions.ts. */
export function broadcast(message: RoomMessage, excludeSessionId?: string): void {
  for (const [id, session] of sessions) {
    if (id !== excludeSessionId) send(session, message);
  }
}

export function attachLockerRoom(wss: WebSocketServer, requestUrl?: string) {
  wss.on("connection", (ws: WebSocket, req: { url?: string }) => {
    const url = new URL(req.url ?? requestUrl ?? "/", "http://localhost");
    const userId = url.searchParams.get("userId") ?? undefined;
    const gameId = url.searchParams.get("gameId") ?? undefined;

    const id = randomUUID();
    const session: Session = { id, ws, userId, gameId };
    sessions.set(id, session);

    send(session, { type: "connected", connectedUsers: sessions.size });
    if (userId) {
      broadcast({ type: "join", userId, connectedUsers: sessions.size }, id);
    }

    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as RoomMessage;
        switch (message.type) {
          case "pick":
            broadcast({ type: "pick", userId, gameId: message.gameId, teamId: message.teamId });
            break;
          case "score_update":
            broadcast({ type: "score_update", gameId: message.gameId, score: message.score });
            break;
          default:
            send(session, { type: "error", message: "Unknown message type" });
        }
      } catch {
        send(session, { type: "error", message: "Invalid message format" });
      }
    });

    ws.on("close", () => {
      sessions.delete(id);
      if (userId) broadcast({ type: "leave", userId, connectedUsers: sessions.size });
    });

    ws.on("error", () => {
      sessions.delete(id);
    });
  });
}

// Called directly from sendChatMessageAction/editChatMessageAction/
// deleteChatMessageAction (src/app/locker-room/actions.ts) instead of
// POSTing to a Durable Object's /broadcast endpoint.
export function broadcastToLockerRoom(payload: RoomMessage): void {
  broadcast(payload);
}
