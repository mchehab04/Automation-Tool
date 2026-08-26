"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { BellIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";

type NotificationRow = Awaited<ReturnType<typeof getUnreadNotifications>>[number];

const POLL_MS = 15000;

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const refresh = () => {
      getUnreadNotifications()
        .then(setNotifications)
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const dismiss = (id: string) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
    startTransition(() => {
      void markNotificationRead(id);
    });
  };

  const dismissAll = () => {
    setNotifications([]);
    startTransition(() => {
      void markAllNotificationsRead();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button aria-label="Notifications" size="icon-sm" variant="outline" />}>
        <span className="relative inline-flex">
          <BellIcon />
          {notifications.length > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-medium text-destructive-foreground">
              {notifications.length > 9 ? "9+" : notifications.length}
            </span>
          ) : null}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <div className="flex items-center justify-between px-1.5 py-1">
            <DropdownMenuLabel className="p-0">Needs your attention</DropdownMenuLabel>
            {notifications.length > 0 ? (
              <button
                type="button"
                onClick={dismissAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <DropdownMenuSeparator />
          {notifications.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex items-start gap-1 rounded-sm px-1.5 py-1.5 hover:bg-muted/50"
              >
                <Link
                  href={`/leads/${notification.leadId}`}
                  onClick={() => dismiss(notification.id)}
                  className="flex min-w-0 flex-1 flex-col gap-0.5"
                >
                  <span className="text-sm font-medium">{notification.lead.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-normal">
                    {notification.message}
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label="Mark as read"
                  title="Mark as read"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    dismiss(notification.id);
                  }}
                  className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Check className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
