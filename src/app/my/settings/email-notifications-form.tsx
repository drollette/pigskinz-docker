"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { updateEmailNotificationsAction } from "./actions";

interface EmailNotificationsFormProps {
  isAdmin: boolean;
  initialEnabled: boolean;
  initialPickReminders: boolean;
  initialAutoPickDigest: boolean;
  initialLockerRoomMentions: boolean;
}

export function EmailNotificationsForm({
  isAdmin,
  initialEnabled,
  initialPickReminders,
  initialAutoPickDigest,
  initialLockerRoomMentions,
}: EmailNotificationsFormProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pickReminders, setPickReminders] = useState(initialPickReminders);
  const [autoPickDigest, setAutoPickDigest] = useState(initialAutoPickDigest);
  const [lockerRoomMentions, setLockerRoomMentions] = useState(initialLockerRoomMentions);
  const [isPending, startTransition] = useTransition();

  const save = (
    newEnabled: boolean,
    newPickReminders: boolean,
    newAutoPickDigest: boolean,
    newLockerRoomMentions: boolean
  ) => {
    startTransition(async () => {
      const result = await updateEmailNotificationsAction(
        newEnabled,
        newPickReminders,
        newAutoPickDigest,
        newLockerRoomMentions
      );
      if ("error" in result) {
        toast.error(result.error);
        setEnabled(enabled);
        setPickReminders(pickReminders);
        setAutoPickDigest(autoPickDigest);
        setLockerRoomMentions(lockerRoomMentions);
      } else {
        toast.success("Email preferences saved");
      }
    });
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <div>
          <div className="font-medium">Email notifications</div>
          <div className="text-sm text-base-content/60">
            Master switch for all notification emails below. Turn this off to stop
            every email at once, regardless of the individual settings.
          </div>
        </div>
        <input
          type="checkbox"
          className="toggle toggle-primary shrink-0"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            save(e.target.checked, pickReminders, autoPickDigest, lockerRoomMentions);
          }}
          disabled={isPending}
        />
      </label>

      <div className="divider my-1" />

      <label
        className={`flex items-center justify-between gap-4 ${enabled ? "cursor-pointer" : "opacity-50"}`}
      >
        <div>
          <div className="font-medium">Pick reminders</div>
          <div className="text-sm text-base-content/60">
            A reminder email if you have games left to pick later that day.
          </div>
        </div>
        <input
          type="checkbox"
          className="toggle toggle-primary shrink-0"
          checked={pickReminders}
          onChange={(e) => {
            setPickReminders(e.target.checked);
            save(enabled, e.target.checked, autoPickDigest, lockerRoomMentions);
          }}
          disabled={isPending || !enabled}
        />
      </label>

      <label
        className={`flex items-center justify-between gap-4 ${enabled ? "cursor-pointer" : "opacity-50"}`}
      >
        <div>
          <div className="font-medium">Auto-pick digest</div>
          <div className="text-sm text-base-content/60">
            An email when auto-pick fills in a game you missed. Only applies if
            auto-pick is enabled above.
          </div>
        </div>
        <input
          type="checkbox"
          className="toggle toggle-primary shrink-0"
          checked={autoPickDigest}
          onChange={(e) => {
            setAutoPickDigest(e.target.checked);
            save(enabled, pickReminders, e.target.checked, lockerRoomMentions);
          }}
          disabled={isPending || !enabled}
        />
      </label>

      {isAdmin && (
        <label
          className={`flex items-center justify-between gap-4 ${enabled ? "cursor-pointer" : "opacity-50"}`}
        >
          <div>
            <div className="font-medium">Locker Room admin alerts</div>
            <div className="text-sm text-base-content/60">
              An email when someone @mentions you (or @admin) or replies to your message in the
              Locker Room, so you can respond by replying to the email.
            </div>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-primary shrink-0"
            checked={lockerRoomMentions}
            onChange={(e) => {
              setLockerRoomMentions(e.target.checked);
              save(enabled, pickReminders, autoPickDigest, e.target.checked);
            }}
            disabled={isPending || !enabled}
          />
        </label>
      )}
    </div>
  );
}
