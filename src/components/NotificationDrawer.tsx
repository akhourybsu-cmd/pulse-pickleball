import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Notification {
  id: string;
  type: "match" | "lfg";
  title: string;
  message: string;
  time: string;
  cta: string;
  link: string;
  unread: boolean;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  notifications: Notification[];
  onClose: () => void;
  onClearAll: () => void;
  onClearOne: (id: string) => void;
  onSelectNotification: (id: string) => void;
}

export function NotificationDrawer({
  isOpen,
  notifications,
  onClose,
  onClearAll,
  onClearOne,
  onSelectNotification,
}: NotificationDrawerProps) {
  const matchNotifications = notifications.filter((n) => n.type === "match");
  const lfgNotifications = notifications.filter((n) => n.type === "lfg");

  const handleCardClick = (notification: Notification) => {
    onSelectNotification(notification.id);
    onClose(); // Close drawer when notification is clicked
    console.log("Go to", notification.link);
  };

  const handleClearOne = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onClearOne(id);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[80vw] max-w-md bg-slate-900 z-50 transition-transform duration-300 shadow-2xl",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="border-b border-slate-700/60 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-lg">Notifications</h2>
            <button
              onClick={onClearAll}
              aria-label="Clear all notifications"
              className="text-lime-300 text-sm font-medium h-8 px-3 rounded hover:bg-slate-700/40 active:scale-95 transition-all"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-73px)] p-4">
          {notifications.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-white font-semibold text-lg mb-2">
                You're all caught up!
              </h3>
              <p className="text-slate-400 text-sm">
                Get back out there and play some Pulse.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending Matches Section */}
              {matchNotifications.length > 0 && (
                <div>
                  <h3 className="text-slate-400 text-xs uppercase tracking-wide mb-2">
                    Pending Matches
                  </h3>
                  <div className="space-y-3">
                    {matchNotifications.map((notification) => (
                      <NotificationCard
                        key={notification.id}
                        notification={notification}
                        onClick={() => handleCardClick(notification)}
                        onClear={(e) => handleClearOne(e, notification.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Court Connector Section */}
              {lfgNotifications.length > 0 && (
                <div>
                  <h3 className="text-slate-400 text-xs uppercase tracking-wide mb-2">
                    Court Connector
                  </h3>
                  <div className="space-y-3">
                    {lfgNotifications.map((notification) => (
                      <NotificationCard
                        key={notification.id}
                        notification={notification}
                        onClick={() => handleCardClick(notification)}
                        onClear={(e) => handleClearOne(e, notification.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface NotificationCardProps {
  notification: Notification;
  onClick: () => void;
  onClear: (e: React.MouseEvent) => void;
}

function NotificationCard({ notification, onClick, onClear }: NotificationCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full bg-slate-800/40 rounded-xl p-3 border border-slate-700/50 text-left",
        "active:scale-[0.99] active:bg-slate-800/60 transition-all",
        notification.unread && "shadow-[0_0_8px_rgba(181,255,96,0.4)] border-lime-300/60"
      )}
    >
      {/* Title Row */}
      <div className="flex items-start justify-between mb-1">
        <h4 className="text-slate-100 font-semibold text-sm flex-1 pr-2">
          {notification.title}
        </h4>
        <button
          onClick={onClear}
          aria-label="Dismiss notification"
          className="text-slate-500 hover:text-slate-300 p-1 -m-1 min-w-[36px] min-h-[36px] flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message */}
      <p className="text-slate-400 text-xs mt-0.5 mb-2">
        {notification.message}
      </p>

      {/* Bottom Row */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500">{notification.time}</span>
        <span className="text-lime-300 text-[11px] font-medium">
          {notification.cta}
        </span>
      </div>
    </button>
  );
}
