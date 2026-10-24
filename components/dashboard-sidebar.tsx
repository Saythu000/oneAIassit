'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTenantInfo } from '@/hooks/useTenantInfo';
import { useSidebar } from '@/lib/sidebar-context';
import { cn } from '@/lib/utils';
import { motion, LayoutGroup } from 'framer-motion';
import {
  LayoutDashboard,
  Inbox,
  Users,
  UserCheck,
  Megaphone,
  CalendarClock,
  LineChart,
  BarChart3,
  Bot,
  FileText,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  X,
  LucideIcon,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  roles?: string[];
  icon: LucideIcon;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { data: info } = useTenantInfo();
  const { isMobileOpen, setIsMobileOpen, isCollapsed, toggleCollapsed } = useSidebar();

  const userRole = info?.role || '';
  const tenantName = info?.tenantName || 'OneAIAssist';

  // Close mobile drawer automatically when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname, setIsMobileOpen]);

  const sections: NavSection[] = [
    {
      title: 'CORE WORKSPACE',
      items: [
        {
          name: 'Dashboard',
          href: '/dashboard',
          icon: LayoutDashboard,
        },
        {
          name: 'Unified Inbox',
          href: '/dashboard/inbox',
          roles: ['PLATFORM_OWNER', 'ADMIN', 'MANAGER', 'AGENT'],
          icon: Inbox,
          badge: 'Live',
          badgeColor: 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30',
        },
        {
          name: 'Leads & Pipeline',
          href: '/dashboard/leads',
          roles: ['PLATFORM_OWNER', 'ADMIN', 'MANAGER', 'AGENT'],
          icon: Users,
        },
        {
          name: 'Customer CRM',
          href: '/dashboard/customers',
          roles: ['PLATFORM_OWNER', 'ADMIN', 'MANAGER', 'AGENT'],
          icon: UserCheck,
        },
      ],
    },
    {
      title: 'MARKETING & AUTOMATION',
      items: [
        {
          name: 'Broadcast Campaigns',
          href: '/dashboard/campaigns',
          roles: ['PLATFORM_OWNER', 'ADMIN', 'MANAGER', 'AGENT'],
          icon: Megaphone,
        },
        {
          name: 'Drip Sequences',
          href: '/dashboard/sequences',
          roles: ['PLATFORM_OWNER', 'ADMIN', 'MANAGER'],
          icon: CalendarClock,
        },
        {
          name: 'Content & Social Hub',
          href: '/dashboard/marketing',
          roles: ['PLATFORM_OWNER', 'ADMIN', 'MANAGER'],
          icon: LineChart,
          badge: 'New',
          badgeColor: 'bg-white/20 text-white border border-white/30',
        },
        {
          name: 'AI Agent & Bot',
          href: '/dashboard/ai-bot',
          roles: ['PLATFORM_OWNER', 'ADMIN', 'MANAGER', 'AGENT'],
          icon: Bot,
        },
        {
          name: 'Message Templates',
          href: '/dashboard/templates',
          roles: ['PLATFORM_OWNER', 'ADMIN', 'MANAGER', 'AGENT'],
          icon: FileText,
        },
      ],
    },
    {
      title: 'ADMIN & SYSTEM',
      items: [
        {
          name: 'Analytics & ROI',
          href: '/dashboard/analytics',
          icon: BarChart3,
        },
        {
          name: 'Channels & Settings',
          href: '/dashboard/settings',
          roles: ['PLATFORM_OWNER', 'ADMIN'],
          icon: Settings,
        },
        {
          name: 'Superadmin Console',
          href: '/superadmin',
          roles: ['PLATFORM_OWNER'],
          icon: ShieldCheck,
        },
      ],
    },
  ];

  const renderNavContent = (collapsed: boolean) => (
    <>
      {/* Brand Header with Original Logo & Colors */}
      <div className={cn(
        "py-4 border-b border-white/10 flex items-center shrink-0 transition-all",
        collapsed ? "px-3 justify-center" : "px-5 justify-between"
      )}>
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/OneAILogo.png"
            alt="OneAIAssist Logo"
            className="h-8 w-8 shrink-0 object-contain"
          />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <span className="font-bold tracking-tight text-white text-base truncate block leading-tight">
                {tenantName}
              </span>
              <span className="text-[10px] text-white/70 truncate block">AI Multi-Channel Platform</span>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto overflow-x-hidden">
        <LayoutGroup id={collapsed ? "sidebar-collapsed" : "sidebar-expanded"}>
          {sections.map((section) => {
            const filteredItems = section.items.filter(
              (item) => !item.roles || !userRole || item.roles.includes(userRole)
            );

            if (filteredItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-1">
                {!collapsed && (
                  <h5 className="px-3 text-[10px] font-bold text-[#E2E8F0]/50 uppercase tracking-widest text-left truncate">
                    {section.title}
                  </h5>
                )}

                <div className="space-y-0.5">
                  {filteredItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    const IconComponent = item.icon;

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        title={collapsed ? item.name : undefined}
                        className={cn(
                          'relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150',
                          collapsed
                            ? 'justify-center p-2.5 my-0.5'
                            : 'gap-3 px-3.5 py-2.5 my-0.5',
                          isActive
                            ? 'text-white font-semibold shadow-sm'
                            : 'text-[#E2E8F0] hover:text-white hover:bg-white/[0.08]'
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeSidebarTab"
                            className="absolute inset-0 bg-[#2563EB] rounded-lg -z-0"
                            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                          />
                        )}
                        <IconComponent className={cn("shrink-0 z-10", collapsed ? "w-5 h-5" : "w-5 h-5")} />
                        {!collapsed && (
                          <span className="z-10 truncate text-xs font-medium flex-1">
                            {item.name}
                          </span>
                        )}
                        {!collapsed && item.badge && (
                          <span className={cn(
                            "z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0",
                            item.badgeColor || "bg-white/20 text-white"
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </LayoutGroup>
      </nav>

      {/* Footer / System Status with Original Colors */}
      <div className={cn(
        "p-3.5 border-t border-white/10 text-xs text-[#E2E8F0]/70 flex items-center shrink-0",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 truncate">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="font-medium text-white/90 text-[11px] truncate">System Online</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">v2.5</span>
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
          isMobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Slide-Over Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-[#1B4B91] border-r border-white/10 text-white w-72 lg:hidden transition-transform duration-300 ease-in-out shadow-2xl h-full",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/OneAILogo.png" alt="Logo" className="h-8 w-8 object-contain" />
            <span className="font-bold text-white text-lg">OneAIAssist</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          {renderNavContent(false)}
        </div>
      </aside>

      {/* Desktop Fixed Sidebar with Original #1B4B91 Royal Navy */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen shrink-0 bg-[#1B4B91] border-r border-white/10 text-white transition-[width] duration-200 ease-in-out z-20 sticky top-0 shadow-md",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        {renderNavContent(isCollapsed)}
      </aside>
    </>
  );
}
