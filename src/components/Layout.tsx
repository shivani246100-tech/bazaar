import { useState, useEffect, useRef } from 'react';
import { Search, Heart, ShoppingCart, Menu, X, User, Store, ChevronDown, Bell, LogOut, Package, MapPin, Ticket, Users, HelpCircle } from 'lucide-react';
import { Link, useRouter } from '@/lib/router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/lib/types';

export function Header() {
  const { user, signOut } = useAuth();
  const { navigate, path } = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [wishCount, setWishCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const [searchVal, setSearchVal] = useState('');
  const catRef = useRef<HTMLDivElement>(null);
  const profRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order').then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    if (!user) { setCartCount(0); setWishCount(0); setNotifCount(0); return; }
    supabase.from('cart_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => setCartCount(count || 0));
    supabase.from('wishlist').select('id', { count: 'exact', head: true }).eq('user_id', user.id).then(({ count }) => setWishCount(count || 0));
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false).then(({ count }) => setNotifCount(count || 0));
  }, [user, path]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
      if (profRef.current && !profRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) navigate(`/search?q=${encodeURIComponent(searchVal.trim())}`);
  };

  const dashboardLink = user?.role === 'admin' ? '/admin' : user?.role === 'seller' ? '/seller' : '/profile';

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex items-center gap-3 h-16">
            {/* Mobile menu */}
            <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100" onClick={() => setMenuOpen(true)}>
              <Menu className="h-5 w-5 text-slate-600" />
            </button>

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center">
                <Store className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 hidden sm:block">Bazaar</span>
            </Link>

            {/* Search */}
            <form onSubmit={doSearch} className="flex-1 max-w-2xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder="Search for products..."
                  className="w-full rounded-xl bg-slate-100 border border-slate-200 pl-10 pr-4 py-2.5 text-sm focus:bg-white focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:outline-none transition-all"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </form>

            {/* Right actions */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <Link to="/become-seller" className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                <Store className="h-4 w-4" />
                Sell
              </Link>

              {user && (
                <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <Bell className="h-5 w-5 text-slate-600" />
                  {notifCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {notifCount > 9 ? '9+' : notifCount}
                    </span>
                  )}
                </Link>
              )}

              <Link to="/wishlist" className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <Heart className="h-5 w-5 text-slate-600" />
                {wishCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {wishCount > 9 ? '9+' : wishCount}
                  </span>
                )}
              </Link>

              <Link to="/cart" className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <ShoppingCart className="h-5 w-5 text-slate-600" />
                {cartCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>

              {user ? (
                <div ref={profRef} className="relative">
                  <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-sm font-semibold text-rose-700">
                      {user.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
                  </button>
                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 animate-in">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-sm font-semibold text-slate-800">{user.full_name}</p>
                        <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                      </div>
                      <MenuItem icon={<User className="h-4 w-4" />} label="My Profile" to="/profile" onClick={() => setProfileOpen(false)} />
                      <MenuItem icon={<Package className="h-4 w-4" />} label="My Orders" to="/orders" onClick={() => setProfileOpen(false)} />
                      <MenuItem icon={<MapPin className="h-4 w-4" />} label="Addresses" to="/addresses" onClick={() => setProfileOpen(false)} />
                      <MenuItem icon={<Ticket className="h-4 w-4" />} label="Coupons" to="/coupons" onClick={() => setProfileOpen(false)} />
                      <MenuItem icon={<Users className="h-4 w-4" />} label="Referrals" to="/referrals" onClick={() => setProfileOpen(false)} />
                      <MenuItem icon={<HelpCircle className="h-4 w-4" />} label="Support" to="/support" onClick={() => setProfileOpen(false)} />
                      {user.role !== 'customer' && (
                        <MenuItem icon={<Store className="h-4 w-4" />} label={user.role === 'admin' ? 'Admin Dashboard' : 'Seller Dashboard'} to={dashboardLink} onClick={() => setProfileOpen(false)} />
                      )}
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <button onClick={() => { signOut(); setProfileOpen(false); navigate('/'); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/login" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 transition-colors">
                  Login
                </Link>
              )}
            </div>
          </div>

          {/* Category bar - desktop */}
          <div className="hidden lg:flex items-center gap-1 h-10 -mt-px">
            <div ref={catRef} className="relative">
              <button onClick={() => setCatOpen(!catOpen)} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <Menu className="h-4 w-4" />
                All Categories
                <ChevronDown className="h-3 w-3" />
              </button>
              {catOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 animate-in z-50">
                  {categories.map((c) => (
                    <Link key={c.id} to={`/category/${c.slug}`} onClick={() => setCatOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors">
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {categories.slice(0, 8).map((c) => (
              <Link key={c.id} to={`/category/${c.slug}`} className="px-3 py-1.5 text-sm text-slate-600 hover:text-rose-600 transition-colors">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl overflow-y-auto animate-in">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <span className="text-lg font-bold text-slate-900">Menu</span>
              <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-1">
              <MobileMenuItem icon={<Store className="h-5 w-5" />} label="Become a Seller" to="/become-seller" onClick={() => setMenuOpen(false)} />
              <div className="pt-2 pb-1 text-xs font-semibold text-slate-400 uppercase">Categories</div>
              {categories.map((c) => (
                <Link key={c.id} to={`/category/${c.slug}`} onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-sm text-slate-700 hover:bg-rose-50 rounded-lg transition-colors">
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuItem({ icon, label, to, onClick }: { icon: React.ReactNode; label: string; to: string; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors">
      {icon}
      {label}
    </Link>
  );
}

function MobileMenuItem({ icon, label, to, onClick }: { icon: React.ReactNode; label: string; to: string; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-rose-50 rounded-lg transition-colors">
      {icon}
      {label}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 mt-12">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center">
                <Store className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Bazaar</span>
            </div>
            <p className="text-sm text-slate-400">Everything you need, all in one place. Discover products from trusted sellers at great prices.</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/category/fashion" className="hover:text-rose-400 transition-colors">Fashion</Link></li>
              <li><Link to="/category/electronics" className="hover:text-rose-400 transition-colors">Electronics</Link></li>
              <li><Link to="/category/home-kitchen" className="hover:text-rose-400 transition-colors">Home & Kitchen</Link></li>
              <li><Link to="/category/beauty-personal-care" className="hover:text-rose-400 transition-colors">Beauty</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Account</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/profile" className="hover:text-rose-400 transition-colors">My Profile</Link></li>
              <li><Link to="/orders" className="hover:text-rose-400 transition-colors">My Orders</Link></li>
              <li><Link to="/wishlist" className="hover:text-rose-400 transition-colors">Wishlist</Link></li>
              <li><Link to="/support" className="hover:text-rose-400 transition-colors">Support</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Sell</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/become-seller" className="hover:text-rose-400 transition-colors">Become a Seller</Link></li>
              <li><Link to="/seller" className="hover:text-rose-400 transition-colors">Seller Dashboard</Link></li>
              <li><Link to="/seller/plans" className="hover:text-rose-400 transition-colors">Seller Plans</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-500">© 2026 Bazaar. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-slate-500">
            <span>Secure Payments</span>
            <span>Easy Returns</span>
            <span>24/7 Support</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function MobileBottomNav() {
  const { path } = useRouter();
  const { user } = useAuth();
  const items = [
    { icon: 'Home', label: 'Home', to: '/' },
    { icon: 'Grid3x3', label: 'Categories', to: '/categories' },
    { icon: 'Search', label: 'Search', to: '/search' },
    { icon: 'Package', label: 'Orders', to: '/orders' },
    { icon: 'User', label: 'Profile', to: user ? '/profile' : '/login' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white border-t border-slate-200 flex items-center justify-around h-14 px-1 pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => {
        const active = path === item.to || (item.to !== '/' && path.startsWith(item.to));
        return (
          <Link key={item.label} to={item.to} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${active ? 'text-rose-600' : 'text-slate-500'}`}>
            <NavIcon name={item.icon} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    Home: <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    Grid3x3: <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18" strokeLinecap="round"/></svg>,
    Search: <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>,
    Package: <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" strokeLinejoin="round"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" strokeLinejoin="round"/></svg>,
    User: <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeLinecap="round"/><circle cx="12" cy="7" r="4"/></svg>,
  };
  return <>{icons[name]}</>;
}
