import { getCurrentUser } from "@/lib/auth";
import { getLockerRoomPanelProps } from "@/lib/locker-room-panel";
import { LockerRoomChat } from "@/app/locker-room/locker-room-chat";

/** Persistent Locker Room chat -- offered as one of a column's selectable
 * views, so players can read/post without leaving what they're doing.
 * Renders nothing if there's no signed-in user (e.g. mid-redirect). */
export async function LockerRoomPanel() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;

  const panelProps = await getLockerRoomPanelProps(user);

  return (
    <div className="space-y-4">
      <div>
        {/* lg+ gets this heading from the column's own dropdown header
            instead (see PanelSelect) -- below that there's no header row at
            all, so this is the only page title a phone gets. */}
        <h1 className="lg:hidden text-2xl font-bold text-base-content">Locker Room</h1>
        <p className="text-sm text-base-content/60">
          Talk picks, talk smack. Type @admin (or a specific admin&apos;s username) to reach
          the admins by email — they can reply straight from their inbox.
        </p>
      </div>
      <LockerRoomChat {...panelProps} />
    </div>
  );
}
