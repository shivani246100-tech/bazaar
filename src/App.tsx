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
import { SellerDashboard } from '@/pages/SellerDashboard';
import { AdminDashboard } from '@/pages/AdminDashboard';

function Routes() {
  const { path } = useRouter();
  const { loading } = useAuth();
  const p = pathname(path);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  // Auth routes (no header/footer)
  if (p === '/login') return <LoginPage />;
  if (p === '/signup') return <SignupPage />;

  // Standalone route: become seller
  if (p === '/become-seller') {
    return (
      <>
        <Header />
        <BecomeSellerPage />
        <Footer />
      </>
    );
  }

  // Seller dashboard routes
  if (p === '/seller' || p.startsWith('/seller/')) {
    return (
      <>
        <Header />
        <SellerDashboard subpath={p} />
      </>
    );
  }

  // Admin dashboard routes
  if (p === '/admin' || p.startsWith('/admin/')) {
    return (
      <>
        <Header />
        <AdminDashboard subpath={p} />
      </>
    );
  }

  // Customer/storefront routes (with header + footer + mobile nav)
  let content: React.ReactNode = null;

  if (p === '/') content = <HomePage />;
  else if (p === '/search') content = <SearchPage />;
  else if (p === '/categories') content = <CategoriesPage />;
  else if (p.startsWith('/category/')) content = <CategoryPage slug={p.replace('/category/', '')} />;
  else if (p.startsWith('/product/')) content = <ProductDetailPage slug={p.replace('/product/', '')} />;
  else if (p.startsWith('/store/')) content = <StorePage slug={p.replace('/store/', '')} />;
  else if (p === '/cart') content = <CartPage />;
  else if (p === '/checkout') content = <CheckoutPage />;
  else if (p === '/orders') content = <OrdersPage />;
  else if (p.startsWith('/orders/')) content = <OrderDetailPage orderId={p.replace('/orders/', '')} />;
  else if (p === '/wishlist') content = <WishlistPage />;
  else if (p === '/addresses') content = <AddressesPage />;
  else if (p === '/notifications') content = <NotificationsPage />;
  else if (p === '/profile') content = <ProfilePage />;
  else if (p === '/coupons') content = <CouponsPage />;
  else if (p === '/referrals') content = <ReferralsPage />;
  else if (p === '/support') content = <SupportPage />;
  else content = <HomePage />;

  return (
    <>
      <Header />
      <main>{content}</main>
      <Footer />
      <MobileBottomNav />
    </>
  );
}

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
