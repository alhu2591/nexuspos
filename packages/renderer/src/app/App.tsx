// NexusPOS — React Application Root
// Entry point: app providers, routing, and layout

import React, { Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { AppLayout } from '../components/layout/AppLayout';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { ToastProvider } from '../components/ui/ToastProvider';
import { HardwareStatusBar } from '../components/hardware/HardwareStatusBar';
import '../i18n';

// ── Lazy-loaded feature screens (code splitting for performance)
const CheckoutScreen = React.lazy(() => import('../features/checkout/screens/CheckoutScreen'));
const DashboardScreen = React.lazy(() => import('../features/dashboard/screens/DashboardScreen'));
const ProductsScreen = React.lazy(() => import('../features/products/screens/ProductsScreen'));
const ProductFormScreen = React.lazy(() => import('../features/products/screens/ProductFormScreen'));
const CategoriesScreen = React.lazy(() => import('../features/categories/screens/CategoriesScreen'));
const InventoryScreen = React.lazy(() => import('../features/inventory/screens/InventoryScreen'));
const CustomersScreen = React.lazy(() => import('../features/customers/screens/CustomersScreen'));
const CustomerDetailScreen = React.lazy(() => import('../features/customers/screens/CustomerDetailScreen'));
const ReceiptsScreen = React.lazy(() => import('../features/receipts/screens/ReceiptsScreen'));
const InvoicesScreen = React.lazy(() => import('../features/invoices/screens/InvoicesScreen'));
const ShiftsScreen = React.lazy(() => import('../features/shifts/screens/ShiftsScreen'));
const ReportsScreen = React.lazy(() => import('../features/reports/screens/ReportsScreen'));
const SettingsScreen = React.lazy(() => import('../features/settings/screens/SettingsScreen'));
const UsersScreen = React.lazy(() => import('../features/users/screens/UsersScreen'));
const LoginScreen = React.lazy(() => import('../features/auth/screens/LoginScreen'));
const CustomerDisplayScreen = React.lazy(() => import('../features/customer-display/screens/CustomerDisplayScreen'));

// ============================================================
// AUTH GUARD
// ============================================================
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuthStore();

  if (isLoading) return <LoadingScreen message="Checking authentication..." />;
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function RequireShift({ children }: { children: React.ReactNode }) {
  const { currentShift } = useSettingsStore();

  // Checkout requires an open shift
  if (!currentShift) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// ============================================================
// ROUTER CONFIGURATION
// ============================================================
const router = createBrowserRouter([
  // Customer display (secondary screen)
  {
    path: '/customer-display',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <CustomerDisplayScreen />
      </Suspense>
    ),
  },

  // Login (unauthenticated)
  {
    path: '/login',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <LoginScreen />
      </Suspense>
    ),
  },

  // Main application (authenticated)
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <DashboardScreen />
          </Suspense>
        ),
      },
      {
        path: 'checkout',
        element: (
          <RequireShift>
            <Suspense fallback={<LoadingScreen />}>
              <CheckoutScreen />
            </Suspense>
          </RequireShift>
        ),
      },
      {
        path: 'products',
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <ProductsScreen />
              </Suspense>
            ),
          },
          {
            path: 'new',
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <ProductFormScreen />
              </Suspense>
            ),
          },
          {
            path: ':id/edit',
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <ProductFormScreen />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: 'categories',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <CategoriesScreen />
          </Suspense>
        ),
      },
      {
        path: 'inventory',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <InventoryScreen />
          </Suspense>
        ),
      },
      {
        path: 'customers',
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <CustomersScreen />
              </Suspense>
            ),
          },
          {
            path: ':id',
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <CustomerDetailScreen />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: 'receipts',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <ReceiptsScreen />
          </Suspense>
        ),
      },
      {
        path: 'invoices',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <InvoicesScreen />
          </Suspense>
        ),
      },
      {
        path: 'shifts',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <ShiftsScreen />
          </Suspense>
        ),
      },
      {
        path: 'reports',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <ReportsScreen />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <SettingsScreen />
          </Suspense>
        ),
      },
      {
        path: 'users',
        element: (
          <Suspense fallback={<LoadingScreen />}>
            <UsersScreen />
          </Suspense>
        ),
      },
    ],
  },

  // Catch-all
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

// ============================================================
// ROOT APP COMPONENT
// ============================================================
export function App() {
  const { initialize } = useAuthStore();
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    // Initialize app state on mount
    Promise.all([
      initialize(),
      loadSettings(),
    ]).catch(console.error);
  }, [initialize, loadSettings]);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ErrorBoundary>
  );
}
