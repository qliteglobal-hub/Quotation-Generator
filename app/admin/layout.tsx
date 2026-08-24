"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Zap, LayoutDashboard, Monitor, Settings, FileText } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const navItems = [
    { href: "/admin", label: "LED Lights", icon: Package },
    { href: "/admin/led-displays", label: "LED Displays", icon: Monitor },
    { href: "/admin/lighting-controls", label: "Lighting Controls", icon: Settings },
    { href: "/admin/drivers", label: "Drivers", icon: Zap },
    ...(session?.user?.email === "admin@qlite.com"
      ? [{ href: "/admin/quotations", label: "Quotations", icon: FileText }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-6 h-6 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Admin Dashboard</span>
              </div>
              <div className="flex gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>

      {/* Main Content */}
      {children}
    </div>
  );
}
