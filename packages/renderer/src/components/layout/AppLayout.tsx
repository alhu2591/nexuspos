// NexusPOS — App Layout with Sidebar Navigation

import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatCents } from '@nexuspos/shared';
import {
  LayoutDashboard, ShoppingCart, Package, Tag, Warehouse,
  Users, Receipt, FileText, ArrowLeftRight, BarChart2,
  Settings, UserCog, ChevronLeft, ChevronRight,
  Clock, AlertTriangle, Wifi, WifiOff, LogOut, Menu,
} from 'lucide-react';
import clsx from 'clsx';

interface NavItem {
  path: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  requiresShift?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'nav.dashboard' },
  { path: '/checkout', icon: <ShoppingCart size={20} />, label: 'nav.checkout', requiresShift: true },
  { path: '/products', icon: <Package size={20} />, label: 'nav.products' },
  { path: '/categories', icon: <Tag size={20} />, label: 'nav.categories' },
  { path: '/inventory', icon: <Warehouse size={20} />, label: 'nav.inventory' },
  { path: '/customers', icon: <Users size={20} />, label: 'nav.customers' },
  { path: '/receipts', icon: <Receipt size={20} />, label: 'nav.receipts' },
  { path: '/invoices', icon: <FileText size={20} />, label: 'nav.invoices' },
  { path: '/shifts', icon: <Clock size={20} />, label: 'nav.shifts' },
  { path: '/reports', icon: <BarChart2 size={20} />, label: 'nav.reports' },
  { path: '/users', icon: <UserCog size={20} />, label: 'nav.users' },
  { path: '/settings', icon: <Settings size={20} />, label: 'nav.settings' },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  const { session, logout } = useAuthStore();
  const { currentShift, syncStatus } = useSettingsStore();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const isCheckoutPage = location.pathname === '/checkout';

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={clsx(
          'flex flex-col bg-gray-900 text-white transition-all duration-200 ease-out flex-shrink-0',
          collapsed ? 'w-16' : 'w-56',
          isCheckoutPage && 'hidden' // Hide sidebar on checkout for max screen space
        )}
      >
        {/* Logo */}
        <div className={clsx(
          'flex items-center gap-3 px-4 py-4 border-b border-gray-700/50',
          collapsed && 'justify-center px-2'
        )}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm">
            N
          </div>
          {!collapsed && (
            <span className="font-bold text-white text-sm tracking-wide">NexusPOS</span>
          )}
        </div>

        {/* Shift status */}
        {!collapsed && (
          <div className={clsx(
            'mx-3 mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2',
            currentShift
              ? 'bg-green-900/50 border border-green-700/50 text-green-300'
              : 'bg-orange-900/50 border border-orange-700/50 text-orange-300'
          )}>
            <Clock size={12} />
            <span>
              {currentShift
                ? `Schicht: ${currentShift.shiftNumber}`
                : 'Keine offene Schicht'}
            </span>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {NAV_ITEMS.map(({ path, icon, label, requiresShift }) => {
            const isDisabled = requiresShift && !currentShift;
            return (
              <NavLink
                key={path}
                to={isDisabled ? '#' : path}
                onClick={isDisabled ? (e) => e.preventDefault() : undefined}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isDisabled
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'text-gray-300 hover:bg-gray-700/70 hover:text-white',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? t(label, label.split('.')[1]) : undefined}
              >
                <span className={clsx('flex-shrink-0', isDisabled && 'opacity-40')}>
                  {icon}
                </span>
                {!collapsed && (
                  <span className={clsx(isDisabled && 'opacity-40')}>
                    {t(label, label.split('.')[1])}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-700/50 p-3 space-y-2">
          {/* Sync status */}
          {!collapsed && (
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-400">
              {syncStatus != null && syncStatus.peerCount > 0 ? (
                <><Wifi size={12} className="text-green-400" /> {(syncStatus?.peerCount ?? 0)} Terminal(s)</>
              ) : (
                <><WifiOff size={12} /> Kein Netz</>
              )}
            </div>
          )}

          {/* User info */}
          <div className={clsx(
            'flex items-center gap-2 px-2',
            collapsed && 'justify-center'
          )}>
            <div className="w-7 h-7 bg-blue-600/30 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
              {session?.user.firstName?.[0]}{session?.user.lastName?.[0]}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">
                  {session?.user.firstName} {session?.user.lastName}
                </p>
                <p className="text-[10px] text-gray-400 truncate">{session?.user.role?.name}</p>
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={() => logout()}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-colors',
              collapsed && 'justify-center'
            )}
            title={collapsed ? 'Abmelden' : undefined}
          >
            <LogOut size={14} />
            {!collapsed && 'Abmelden'}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-10 bg-gray-700 hover:bg-gray-600 rounded-r-md flex items-center justify-center text-gray-300 transition-colors z-10"
          style={{ left: collapsed ? '64px' : '224px' }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {/* Top bar (hidden on checkout) */}
        {!isCheckoutPage && (
          <header className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm h-12 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-semibold text-gray-700 capitalize">
                {location.pathname.split('/')[1] || 'Dashboard'}
              </h1>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400">
              {/* Current time */}
              <ClockDisplay />

              {/* Shift cash balance */}
              {currentShift && (
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded-md font-medium">
                  Kasse: {formatCents(currentShift.openingBalance, 'de-DE', 'EUR')}
                </span>
              )}
            </div>
          </header>
        )}

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function ClockDisplay() {
  const [time, setTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="font-mono">
      {time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}
