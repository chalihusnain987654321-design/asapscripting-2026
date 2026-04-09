"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Play,
  ScrollText,
  Users,
  Settings,
  LogOut,
  Globe,
  Crown,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard, minRole: "admin" },
  { href: "/scripts", label: "Scripts", icon: Play, minRole: "admin" },
  { href: "/backlinks", label: "Backlinks", icon: Link2, minRole: "admin" },
  { href: "/logs", label: "Logs", icon: ScrollText, minRole: "super-admin" },
  { href: "/users", label: "Users", icon: Users, minRole: "super-admin" },
  { href: "/settings", label: "Settings", icon: Settings, minRole: "super-admin" },
];

function roleRank(role?: string): number {
  if (role === "super-admin") return 3;
  if (role === "admin") return 2;
  return 1;
}

function minRoleRank(minRole: string): number {
  if (minRole === "super-admin") return 3;
  if (minRole === "admin") return 2;
  return 1;
}

function roleBadgeLabel(role?: string) {
  if (role === "super-admin") return "Admin";
  return "User";
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const myRank = roleRank(role);

  const visibleItems = navItems.filter((item) => myRank >= minRoleRank(item.minRole));

  return (
    <aside className="flex h-screen w-60 flex-col bg-gray-900 text-gray-100">
      {/* Brand */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-700">
        <Globe className="h-6 w-6 text-blue-400" />
        <span className="text-lg font-bold tracking-tight">ASAP</span>
        <span className="text-xs text-gray-400 mt-0.5">Dashboard</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + sign out */}
      <div className="border-t border-gray-700 px-4 py-4 space-y-3">
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold uppercase">
            {session?.user?.name?.[0] ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-100">
              {session?.user?.name}
            </p>
            <div className="flex items-center gap-1">
              {role === "super-admin" && (
                <Crown className="h-3 w-3 text-yellow-400" />
              )}
              <p className="truncate text-xs text-gray-400">
                {roleBadgeLabel(role)}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
