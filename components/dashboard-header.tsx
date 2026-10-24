'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTenantInfo } from '@/hooks/useTenantInfo';
import { useSidebar } from '@/lib/sidebar-context';
import NotificationBell from '@/components/notification-bell';
import { signOut } from 'next-auth/react';
import { 
  Menu, 
  PanelLeftClose, 
  PanelLeft, 
  Search,
  LogOut,
  ChevronRight,
  Activity,
  Sparkles
} from 'lucide-react';

export default function DashboardHeader() {
  const pathname = usePathname();
  const { data: info, isLoading } = useTenantInfo();
  const { setIsMobileOpen, isCollapsed, toggleCollapsed } = useSidebar();

  const getPageHierarchy = () => {
    if (pathname === '/dashboard') return { category: 'Core', title: 'Dashboard Overview' };
    if (pathname.startsWith('/dashboard/inbox')) return { category: 'Workspace', title: 'Unified Inbox' };
    if (pathname.startsWith('/dashboard/leads')) return { category: 'CRM', title: 'Leads & Pipeline' };
    if (pathname.startsWith('/dashboard/customers')) return { category: 'CRM', title: 'Customer Directory' };
    if (pathname.startsWith('/dashboard/campaigns')) return { category: 'Marketing', title: 'Broadcast Campaigns' };
    if (pathname.startsWith('/dashboard/sequences')) return { category: 'Automation', title: 'Drip Sequences' };
    if (pathname.startsWith('/dashboard/marketing')) return { category: 'Marketing', title: 'Social & Content Hub' };
    if (pathname.startsWith('/dashboard/analytics')) return { category: 'Intelligence', title: 'Performance Analytics' };
    if (pathname.startsWith('/dashboard/ai-bot')) return { category: 'Agents', title: 'AI Bot & Autonomous Controls' };
    if (pathname.startsWith('/dashboard/templates')) return { category: 'Content', title: 'Message Templates' };
    if (pathname.startsWith('/dashboard/settings')) return { category: 'Configuration', title: 'Settings & Integrations' };
    if (pathname.startsWith('/superadmin')) return { category: 'Master', title: 'Superadmin Console' };

    const parts = pathname.split('/').filter(Boolean);
    const title = parts.length >= 2 
      ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1).replace(/-/g, ' ') 
      : 'Dashboard';
    return { category: 'Workspace', title };
  };

  const { category, title } = getPageHierarchy();
  const userInitial = info?.email ? info.email.charAt(0).toUpperCase() : 'A';

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/85 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-10 shrink-0 font-sans transition-all sticky top-0">
      {/* Left: Mobile Drawer Trigger + Desktop Rail Toggle + Breadcrumbs */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Sidebar Collapse Toggle */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden lg:flex p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs truncate">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 font-medium transition-colors hidden sm:inline">
            OneAIAssist
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline shrink-0" />
          <span className="text-slate-400 font-medium hidden md:inline">{category}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden md:inline shrink-0" />
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 truncate">
            {title}
          </h1>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="hidden xl:flex items-center flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            readOnly
            placeholder="Search leads, campaigns, or channels... (⌘K)"
            onClick={() => {
              // Quick search helper
              const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
              window.dispatchEvent(event);
            }}
            className="w-full pl-9 pr-12 py-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl text-xs text-slate-600 placeholder:text-slate-400 cursor-pointer transition outline-none"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs pointer-events-none">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Channel Status, Notifications, User Profile & Sign Out */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Realtime Channel Health Badge */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-full text-xs font-medium text-slate-600">
          <Activity className="w-3.5 h-3.5 text-indigo-600" />
          <span>All Channels <strong className="text-emerald-600 font-bold">Active</strong></span>
        </div>

        {/* Notification Bell */}
        <NotificationBell />

        {/* User Info & Profile */}
        {isLoading ? (
          <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-xl" />
        ) : (
          <div className="flex items-center gap-2.5 pl-1">
            {/* User Avatar Circle */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
              {userInitial}
            </div>

            <div className="hidden sm:block text-right leading-tight">
              <p className="text-xs text-slate-900 font-semibold truncate max-w-[130px]">
                {info?.email?.split('@')[0] || 'Admin'}
              </p>
              <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-50 border border-indigo-200/70 text-indigo-700 uppercase tracking-wider">
                {info?.role || 'ADMIN'}
              </span>
            </div>
          </div>
        )}

        {/* Sleek Sign Out Button */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="p-2 sm:px-3 sm:py-1.5 border border-slate-200/80 hover:border-rose-200 hover:bg-rose-50/80 rounded-xl text-xs font-semibold transition-all text-slate-600 hover:text-rose-700 flex items-center gap-1.5"
          title="Sign out of OneAIAssist"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
