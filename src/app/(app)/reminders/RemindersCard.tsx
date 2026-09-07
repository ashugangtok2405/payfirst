"use client";

import { useEffect, useState } from "react";
import { savePushSubscription, deletePushSubscription, updateReminderDays } from "./actions";
import { primaryButtonClass, ghostButtonClass } from "@/components/form";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type SupportState = "checking" | "unsupported" | "not-subscribed" | "subscribed" | "denied";

export default function RemindersCard({ reminderDaysBefore }: { reminderDaysBefore: number }) {
  const [state, setState] = useState<SupportState>("checking");
  const [days, setDays] = useState(reminderDaysBefore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      setState(existing ? "subscribed" : "not-subscribed");
    }
    check().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "not-subscribed");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Push notifications are not configured.");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = subscription.toJSON();
      await savePushSubscription({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      });
      setState("subscribed");
    } catch {
      setError("Could not enable notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("not-subscribed");
    } catch {
      setError("Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDays(next: number) {
    setDays(next);
    try {
      await updateReminderDays(next);
    } catch {
      setError("Could not save reminder setting.");
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-medium text-slate-900 text-sm">Due-date reminders</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {state === "unsupported" && "Not supported on this browser."}
          {state === "denied" && "Notifications are blocked — enable them in your browser/site settings."}
          {state === "checking" && "Checking status…"}
          {state === "not-subscribed" && "Get a push notification before things are due."}
          {state === "subscribed" && "Enabled on this device."}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Remind me
          <input
            type="number"
            min={0}
            max={30}
            value={days}
            onChange={(e) => saveDays(Number(e.target.value))}
            className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          day(s) before
        </label>
        {(state === "not-subscribed" || state === "checking") && (
          <button onClick={enable} disabled={busy || state === "checking"} className={primaryButtonClass}>
            Enable
          </button>
        )}
        {state === "subscribed" && (
          <button onClick={disable} disabled={busy} className={ghostButtonClass}>
            Disable
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600 w-full">{error}</p>}
    </div>
  );
}
