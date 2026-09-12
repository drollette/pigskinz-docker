import { NextRequest, NextResponse } from "next/server";

// Actual WebSocket upgrades to this path never reach here -- they're
// intercepted in server.ts's own `upgrade` handler, ahead of Next's request
// handler, and routed directly to the in-process WebSocket server (see
// src/realtime/locker-room.ts). A Next.js Route Handler can't proxy a raw
// 101-status Response through its own response pipeline (Node's Response
// type doesn't even permit status 101), so this handler only exists to
// answer non-upgrade requests to this path (e.g. someone hitting it
// directly in a browser).
export async function GET(request: NextRequest) {
  const upgradeHeader = request.headers.get("Upgrade");

  if (upgradeHeader !== "websocket") {
    return NextResponse.json(
      { error: "Expected WebSocket upgrade" },
      { status: 426 }
    );
  }

  return NextResponse.json(
    { error: "WebSocket upgrade not available" },
    { status: 500 }
  );
}
