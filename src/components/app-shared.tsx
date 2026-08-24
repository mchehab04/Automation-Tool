import type { ReactNode } from "react";
import { LayoutDashboardIcon, Users2Icon, BarChart3Icon } from "lucide-react";

export type SidebarNavItem = {
	title: string;
	path?: string;
	icon?: ReactNode;
	isActive?: boolean;
	subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
	label?: string;
	items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
	{
		items: [
			{
				title: "Dashboard",
				path: "/dashboard",
				icon: <LayoutDashboardIcon />,
			},
			{
				title: "Leads",
				path: "/leads",
				icon: <Users2Icon />,
			},
			{
				title: "Analytics",
				path: "/analytics",
				icon: <BarChart3Icon />,
			},
		],
	},
];

export const footerNavLinks: SidebarNavItem[] = [];

export const navLinks: SidebarNavItem[] = [
	...navGroups.flatMap((group) =>
		group.items.flatMap((item) =>
			item.subItems?.length ? [item, ...item.subItems] : [item]
		)
	),
	...footerNavLinks,
];
