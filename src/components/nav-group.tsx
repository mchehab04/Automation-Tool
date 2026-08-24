"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { SidebarNavGroup, SidebarNavItem } from "@/components/app-shared";
import { ChevronRightIcon } from "lucide-react";

function isItemActive(pathname: string, item: SidebarNavItem): boolean {
	if (item.path && pathname.startsWith(item.path)) return true;
	return item.subItems?.some((sub) => isItemActive(pathname, sub)) ?? false;
}

// Items with sub-items track their own open state locally, opening
// automatically when navigation makes them active but never fighting a
// manual toggle — `defaultOpen` alone re-derives on every route change,
// which Base UI (correctly) warns about on an uncontrolled Collapsible.
// Adjusting state during render (not in an effect) on prop change is the
// React-recommended pattern for this: https://react.dev/learn/you-might-not-need-an-effect
function CollapsibleNavItem({
	item,
	active,
	pathname,
}: {
	item: SidebarNavItem;
	active: boolean;
	pathname: string;
}) {
	const [open, setOpen] = useState(active);
	const [prevActive, setPrevActive] = useState(active);

	if (active !== prevActive) {
		setPrevActive(active);
		if (active) setOpen(true);
	}

	return (
		<Collapsible
			className="group/collapsible"
			open={open}
			onOpenChange={setOpen}
			render={<SidebarMenuItem />}
		>
			<CollapsibleTrigger render={<SidebarMenuButton isActive={active} />}>
				{item.icon}
				<span>{item.title}</span>
				<ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<SidebarMenuSub>
					{item.subItems?.map((subItem) => (
						<SidebarMenuSubItem key={subItem.title}>
							<SidebarMenuSubButton
								isActive={isItemActive(pathname, subItem)}
								render={<Link href={subItem.path ?? "#"} />}
							>
								{subItem.icon}
								<span>{subItem.title}</span>
							</SidebarMenuSubButton>
						</SidebarMenuSubItem>
					))}
				</SidebarMenuSub>
			</CollapsibleContent>
		</Collapsible>
	);
}

export function NavGroup({ label, items }: SidebarNavGroup) {
	const pathname = usePathname();

	return (
		<SidebarGroup>
			{label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
			<SidebarMenu>
				{items.map((item) => {
					const active = isItemActive(pathname, item);
					if (item.subItems?.length) {
						return (
							<CollapsibleNavItem key={item.title} item={item} active={active} pathname={pathname} />
						);
					}
					return (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton isActive={active} render={<Link href={item.path ?? "#"} />}>
								{item.icon}
								<span>{item.title}</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
}
