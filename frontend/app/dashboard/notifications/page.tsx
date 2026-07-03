"use client";
import { useEffect, useState } from "react";
import { communityApi } from "@/lib/api";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filter, setFilter] = useState(false);

  useEffect(() => {
    communityApi.getNotifications(filter).then((r) => setNotifications(r.data));
  }, [filter]);

  const markRead = async (id: number) => {
    await communityApi.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const typeIcon: Record<string, string> = { info: "ℹ️", warning: "⚠️", emergency: "🚨", reminder: "⏰" };
  const typeColor: Record<string, string> = {
    info: "border-blue-200 bg-blue-50",
    warning: "border-yellow-200 bg-yellow-50",
    emergency: "border-red-200 bg-red-50",
    reminder: "border-green-200 bg-green-50",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">🔔 Notifications</h1>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={filter} onChange={(e) => setFilter(e.target.checked)} className="rounded" />
          Unread only
        </label>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <div className="text-5xl mb-3">🔔</div>
          <p className="text-gray-400">No notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className={`rounded-xl p-4 border ${typeColor[n.notification_type] || "border-gray-200 bg-white"} ${!n.is_read ? "shadow-sm" : "opacity-70"}`}>
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{typeIcon[n.notification_type] || "🔔"}</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{n.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex-shrink-0">Mark read</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
