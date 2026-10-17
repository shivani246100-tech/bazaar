import { useEffect } from 'react';
import { useRouter, pathname, RouterProvider } from '@/lib/router';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/Toast';
import { Header, Footer, MobileBottomNav } from '@/components/Layout';
import { Spinner } from '@/components/ui/Common';

import { LoginPage, SignupPage } from '@/pages/Auth';
import { HomePage } from '@/pages/HomePage';
import { SearchPage, CategoryPage, CategoriesPage } from '@/pages/SearchPage';
import { ProductDetailPage, StorePage } from '@/pages/ProductDetailPage';
import { CartPage, CheckoutPage } from '@/pages/CartCheckout';
import {
  OrdersPage, OrderDetailPage, WishlistPage, AddressesPage,
  NotificationsPage, ProfilePage, CouponsPage, ReferralsPage, SupportPage,
} from '@/pages/CustomerPages';
import { BecomeSellerPage } from '@/pages/BecomeSellerPage';
import { OrderSuccessPage } from '@/pages/OrderSuccessPage';
import { SellerDashboard } from '@/pages/SellerDashboard';
import { AdminDashboard } from '@/pages/AdminDashboard';

// ─── Spinner helper ───────────────────────────────────────────
function CenterSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Spinner className="h-10 w-10 text-rose-600" />
    </div>
  );
}

// ─── Route Guards ─────────────────────────────────────────────

/** Sirf logged-in users ke liye */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { navigate } = useRouter();
  if (loading) return <CenterSpinner />;
  if (!user) { navigate('/login'); return null; }
  return <>{children}</>;
}

/** Sirf seller ya admin ke liye */
function RequireSeller({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { navigate } = useRouter();
  if (loading) return <CenterSpinner />;
  if (!user) { navigate('/login'); return null; }
  if (user.role !== 'seller' && user.role !== 'admin') {
    navigate('/become-seller'); return null;
  }
  return <>{children}</>;
}

/** Sirf admin ke liye */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { navigate } = useRouter();
  if (loading) return <CenterSpinner />;
  if (!user) { navigate('/login'); return null; }
  if (user.role !== 'admin') { navigate('/'); return null; }
  return <>{children}</>;
}

// ─── Routes ───────────────────────────────────────────────────
function Routes() {
  const { path, navigate } = useRouter();
  const { loading, user } = useAuth();
  const p = pathname(path);

  // Global loading screen
  if (loading) return <CenterSpinner />;

  // ── LOGIN page ──
  if (p === '/login') {
    // Pehle se logged in? Apne dashboard pe bhejo
    if (user) {
      if (user.role === 'admin') { navigate('/admin'); return null; }
      if (user.role === 'seller') { navigate('/seller'); return null; }
      navigate('/'); return null;
    }
    return <LoginPage />;
  }

  // ── SIGNUP page ──
  if (p === '/signup') {
    if (user) { navigate('/'); return null; }
    return <SignupPage />;
  }

  // ── ADMIN dashboard — sirf admin dekh sakta hai ──
  if (p === '/admin' || p.startsWith('/admin/')) {
    return (
      <RequireAdmin>
        <Header />
        <AdminDashboard subpath={p} />
      </RequireAdmin>
    );
  }

  // ── SELLER dashboard — sirf seller ya admin dekh sakta hai ──
  if (p === '/seller' || p.startsWith('/seller/')) {
    return (
      <RequireSeller>
        <Header />
        <SellerDashboard subpath={p} />
      </RequireSeller>
    );
  }

  // ── BECOME SELLER ──
  if (p === '/become-seller') {
    return (
      <>
        <Header />
        <BecomeSellerPage />
        <Footer />
      </>
    );
  }

  // ── PUBLIC + CUSTOMER pages ──
  let content: React.ReactNode;

  switch (true) {
    case p === '/':                   content = <HomePage />; break;
    case p === '/search':             content = <SearchPage />; break;
    case p === '/categories':         content = <CategoriesPage />; break;
    case p.startsWith('/category/'):  content = <CategoryPage slug={p.replace('/category/', '')} />; break;
    case p.startsWith('/product/'):   content = <ProductDetailPage slug={p.replace('/product/', '')} />; break;
    case p.startsWith('/store/'):     content = <StorePage slug={p.replace('/store/', '')} />; break;
    case p === '/cart':               content = <CartPage />; break;
    case p === '/checkout':           content = <RequireAuth><CheckoutPage /></RequireAuth>; break;
    case p === '/order-success':      content = <RequireAuth><OrderSuccessPage /></RequireAuth>; break;
    case p === '/orders':             content = <RequireAuth><OrdersPage /></RequireAuth>; break;
    case p.startsWith('/orders/'):    content = <RequireAuth><OrderDetailPage orderId={p.replace('/orders/', '')} /></RequireAuth>; break;
    case p === '/wishlist':           content = <RequireAuth><WishlistPage /></RequireAuth>; break;
    case p === '/addresses':          content = <RequireAuth><AddressesPage /></RequireAuth>; break;
    case p === '/notifications':      content = <RequireAuth><NotificationsPage /></RequireAuth>; break;
    case p === '/profile':            content = <RequireAuth><ProfilePage /></RequireAuth>; break;
    case p === '/coupons':            content = <RequireAuth><CouponsPage /></RequireAuth>; break;
    case p === '/referrals':          content = <RequireAuth><ReferralsPage /></RequireAuth>; break;
    case p === '/support':            content = <RequireAuth><SupportPage /></RequireAuth>; break;
    default:                          content = <HomePage />;
  }

  return (
    <>
      <Header />
      <main className="min-h-screen">{content}</main>
      <Footer />
      <MobileBottomNav />
    </>
  );
}

// ─── App Root ─────────────────────────────────────────────────
function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <ToastProvider>
          <Routes />
        </ToastProvider>
      </AuthProvider>
    </RouterProvider>
  );
}

export default App;
