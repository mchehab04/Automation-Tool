"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getUnreadNotifications, markNotificationRead } from "@/lib/actions/notifications";

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
          <DropdownMenuLabel>Needs your attention</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                render={<Link href={`/leads/${notification.leadId}`} />}
                onClick={() => dismiss(notification.id)}
                className="flex flex-col items-start gap-0.5 whitespace-normal"
              >
                <span className="text-sm font-medium">{notification.lead.name}</span>
                <span className="text-xs text-muted-foreground">{notification.message}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
