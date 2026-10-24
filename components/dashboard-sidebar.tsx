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
  Sparkles,
  Zap,
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
          badgeColor: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
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
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
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
      {/* Workspace Switcher / Brand Header */}
      <div className={cn(
        "py-4 border-b border-slate-800/80 flex items-center shrink-0 transition-all",
        collapsed ? "px-3 justify-center" : "px-4 justify-between"
      )}>
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 shrink-0 group-hover:scale-105 transition-transform duration-200">
            <Zap className="w-5 h-5 fill-white text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-white text-sm truncate">
                  {tenantName}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                  Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">AI Multi-Channel Suite</p>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <LayoutGroup id={collapsed ? "sidebar-collapsed" : "sidebar-expanded"}>
          {sections.map((section) => {
            const filteredItems = section.items.filter(
              (item) => !item.roles || !userRole || item.roles.includes(userRole)
            );

            if (filteredItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-1.5">
                {!collapsed && (
                  <h5 className="px-3 text-[10px] font-extrabold text-slate-400/80 uppercase tracking-widest text-left truncate">
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
                          'relative flex items-center rounded-xl text-xs font-medium transition-all duration-150 group',
                          collapsed
                            ? 'justify-center p-2.5 my-0.5'
                            : 'gap-3 px-3 py-2.5 my-0.5',
                          isActive
                            ? 'text-white font-semibold'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeSidebarTab"
                            className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl shadow-md shadow-indigo-600/30 -z-0"
                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                          />
                        )}
                        <IconComponent
                          className={cn(
                            "shrink-0 z-10 transition-colors duration-200",
                            collapsed ? "w-5 h-5" : "w-4 h-4",
                            isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                          )}
                        />
                        {!collapsed && (
                          <span className="z-10 truncate text-xs flex-1">
                            {item.name}
                          </span>
                        )}
                        {!collapsed && item.badge && (
                          <span className={cn(
                            "z-10 text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-tight shrink-0",
                            item.badgeColor || "bg-indigo-500/20 text-indigo-300"
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

      {/* Footer / System Status */}
      <div className={cn(
        "p-3.5 border-t border-slate-800/80 bg-slate-950/40 text-xs text-slate-400 flex items-center shrink-0",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 truncate">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-slate-300 text-[11px] truncate">AI & Engine Live</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50">
              v2.5
            </span>
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
          "fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
          isMobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Slide-Over Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0B0F19] border-r border-slate-800/80 text-white w-72 lg:hidden transition-transform duration-300 ease-in-out shadow-2xl h-full",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <span className="font-bold text-white text-base">OneAIAssist</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          {renderNavContent(false)}
        </div>
      </aside>

      {/* Desktop Fixed Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen shrink-0 bg-[#0B0F19] border-r border-slate-800/80 text-white transition-[width] duration-200 ease-in-out z-20 sticky top-0 shadow-sm",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        {renderNavContent(isCollapsed)}
      </aside>
    </>
  );
}
