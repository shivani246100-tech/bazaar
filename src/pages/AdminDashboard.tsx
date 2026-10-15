import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRouter, Link, pathname } from '@/lib/router';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card, Badge, EmptyState, Spinner } from '@/components/ui/Common';
import { Select, Input, Textarea, Field } from '@/components/ui/Input';
import type { Product, Order, SellerProfile, Category, Withdrawal, Coupon, SubscriptionPlan, Profile } from '@/lib/types';
import { formatINR, formatDate, slugify, ORDER_STATUS_LABELS } from '@/lib/utils';
import { LayoutDashboard, Users, Store, Package, ShoppingBag, DollarSign, Wallet, ArrowUpRight, Ticket, Star, Bell, Settings, Check, X, Plus, TrendingUp, Trash2, Edit, ChevronRight, BarChart3, Tag, Grid3x3 } from 'lucide-react';

const NAV = [
  { label: 'Overview', icon: LayoutDashboard, path: '/admin' },
  { label: 'Users', icon: Users, path: '/admin/users' },
  { label: 'Sellers', icon: Store, path: '/admin/sellers' },
  { label: 'Products', icon: Package, path: '/admin/products' },
  { label: 'Categories', icon: Grid3x3, path: '/admin/categories' },
  { label: 'Orders', icon: ShoppingBag, path: '/admin/orders' },
  { label: 'Commissions', icon: DollarSign, path: '/admin/commissions' },
  { label: 'Withdrawals', icon: ArrowUpRight, path: '/admin/withdrawals' },
  { label: 'Plans', icon: Ticket, path: '/admin/plans' },
  { label: 'Coupons', icon: Tag, path: '/admin/coupons' },
  { label: 'Reviews', icon: Star, path: '/admin/reviews' },
  { label: 'Settings', icon: Settings, path: '/admin/settings' },
];

export function AdminDashboard({ subpath }: { subpath: string }) {
  const { user, loading: authLoading } = useAuth();
  const { navigate } = useRouter();

  useEffect(() => {
    if (!authLoading && !user) { navigate('/login'); return; }
    if (!authLoading && user && user.role !== 'admin') { navigate('/'); return; }
  }, [user, authLoading, navigate]);

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center"><Spinner className="h-8 w-8" /></div>;
  if (user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          <aside className="hidden lg:block w-60 shrink-0">
            <div className="sticky top-20">
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center"><Settings className="h-5 w-5 text-white" /></div>
                  <div><p className="text-sm font-semibold text-slate-800">Admin Panel</p><Badge variant="default">Admin</Badge></div>
                </div>
                <nav className="space-y-0.5">
                  {NAV.map(item => {
                    const active = subpath === item.path || (item.path !== '/admin' && subpath.startsWith(item.path));
                    return <Link key={item.path} to={item.path} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:bg-slate-50'}`}><item.icon className="h-4 w-4" />{item.label}</Link>;
                  })}
                </nav>
              </Card>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="lg:hidden mb-4 overflow-x-auto">
              <div className="flex gap-1 pb-1">
                {NAV.map(item => {
                  const active = subpath === item.path || (item.path !== '/admin' && subpath.startsWith(item.path));
                  return <Link key={item.path} to={item.path} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}><item.icon className="h-3.5 w-3.5" />{item.label}</Link>;
                })}
              </div>
            </div>

            {subpath === '/admin' && <AdminOverview />}
            {subpath === '/admin/users' && <AdminUsers />}
            {subpath === '/admin/sellers' && <AdminSellers />}
            {subpath === '/admin/products' && <AdminProducts />}
            {subpath === '/admin/categories' && <AdminCategories />}
            {subpath === '/admin/orders' && <AdminOrders />}
            {subpath === '/admin/commissions' && <AdminCommissions />}
            {subpath === '/admin/withdrawals' && <AdminWithdrawals />}
            {subpath === '/admin/plans' && <AdminPlans />}
            {subpath === '/admin/coupons' && <AdminCoupons />}
            {subpath === '/admin/reviews' && <AdminReviews />}
            {subpath === '/admin/settings' && <AdminSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ OVERVIEW ============
function AdminOverview() {
  const [stats, setStats] = useState({ users: 0, sellers: 0, products: 0, pending: 0, orders: 0, revenue: 0, commission: 0, withdrawals: 0, recentOrders: [] as Order[] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [u, s, p, pend, o, wd, recent] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('seller_profiles').select('id, total_sales', { count: 'exact' }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('id, total, commission_amount'),
        supabase.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('*, seller:seller_profiles(store_name), order_items(*)').order('created_at', { ascending: false }).limit(5),
      ]);
      const revenue = (o.data || []).reduce((sum: number, ord: any) => sum + ord.total, 0);
      const commission = (o.data || []).reduce((sum: number, ord: any) => sum + ord.commission_amount, 0);
      setStats({ users: u.count || 0, sellers: s.count || 0, products: p.count || 0, pending: pend.count || 0, orders: o.count || 0, revenue, commission, withdrawals: wd.count || 0, recentOrders: (recent.data as any) || [] });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  const statCards = [
    { label: 'Total Users', value: stats.users, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Total Sellers', value: stats.sellers, icon: Store, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Total Products', value: stats.products, icon: Package, color: 'bg-amber-50 text-amber-600' },
    { label: 'Pending Products', value: stats.pending, icon: Package, color: 'bg-orange-50 text-orange-600' },
    { label: 'Total Orders', value: stats.orders, icon: ShoppingBag, color: 'bg-purple-50 text-purple-600' },
    { label: 'Total Revenue', value: formatINR(stats.revenue), icon: DollarSign, color: 'bg-rose-50 text-rose-600' },
    { label: 'Commission Earned', value: formatINR(stats.commission), icon: TrendingUp, color: 'bg-teal-50 text-teal-600' },
    { label: 'Pending Withdrawals', value: stats.withdrawals, icon: ArrowUpRight, color: 'bg-red-50 text-red-600' },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Admin Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s, i) => (
          <Card key={i} className="p-4">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mb-3`}><s.icon className="h-5 w-5" /></div>
            <p className="text-xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent Orders</h3>
        {stats.recentOrders.length === 0 ? <EmptyState icon={<ShoppingBag className="h-12 w-12" />} title="No orders yet" /> : (
          <div className="space-y-2">
            {stats.recentOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div><p className="text-sm font-medium text-slate-800">{o.order_number}</p><p className="text-xs text-slate-400">{formatDate(o.created_at)} · {(o as any).seller?.store_name}</p></div>
                <div className="flex items-center gap-2"><span className="text-sm font-semibold">{formatINR(o.total)}</span><Badge variant="info">{ORDER_STATUS_LABELS[o.status] || o.status}</Badge></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ USERS ============
function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => { setUsers(data || []); setLoading(false); });
  }, []);

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('profiles').update({ is_active: !current }).eq('id', id);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !current } : u));
    push('success', 'User status updated');
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Users ({users.length})</h1>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100 bg-slate-50"><th className="px-4 py-3">Name</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-xs font-semibold text-rose-700">{u.full_name?.charAt(0).toUpperCase() || 'U'}</div><span className="font-medium text-slate-800">{u.full_name}</span></div></td>
                  <td className="px-4 py-3"><Badge variant={u.role === 'admin' ? 'default' : u.role === 'seller' ? 'info' : 'rose'}>{u.role}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{u.phone || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3"><Badge variant={u.is_active ? 'success' : 'error'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3"><Button size="sm" variant="ghost" onClick={() => toggleActive(u.id, u.is_active)}>{u.is_active ? 'Deactivate' : 'Activate'}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============ SELLERS ============
function AdminSellers() {
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    supabase.from('seller_profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => { setSellers(data || []); setLoading(false); });
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('seller_profiles').update({ seller_status: status }).eq('id', id);
    setSellers(prev => prev.map(s => s.id === id ? { ...s, seller_status: status as any } : s));
    push('success', 'Seller status updated');
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Sellers ({sellers.length})</h1>
      <div className="space-y-3">
        {sellers.map(s => (
          <Card key={s.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center"><Store className="h-5 w-5 text-rose-600" /></div>
              <div><p className="text-sm font-semibold text-slate-800">{s.store_name}</p><p className="text-xs text-slate-400">{s.business_name} · Rating: {s.rating} · {formatINR(s.total_sales)} sales</p></div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={s.kyc_status === 'verified' ? 'success' : 'warning'}>KYC: {s.kyc_status}</Badge>
              <Select value={s.seller_status} onChange={e => updateStatus(s.id, e.target.value)} className="w-auto text-xs py-1.5">
                <option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="rejected">Rejected</option>
              </Select>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ PRODUCTS ============
function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const { push } = useToast();

  const fetch = async () => {
    const { data } = await supabase.from('products').select('*, category:categories(*), seller:seller_profiles(*), product_images(*)').order('created_at', { ascending: false });
    setProducts((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('products').update({ status }).eq('id', id);
    push('success', `Product ${status}`);
    fetch();
  };

  const toggleFlag = async (id: string, field: 'is_featured' | 'is_trending', current: boolean) => {
    await supabase.from('products').update({ [field]: !current }).eq('id', id);
    fetch();
  };

  const filtered = filter === 'all' ? products : products.filter(p => p.status === filter);

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Products ({products.length})</h1>
      <div className="flex gap-2 mb-4">
        {['pending', 'approved', 'rejected', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{f}</button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map(p => (
          <Card key={p.id} className="p-4 flex flex-wrap items-center gap-3">
            <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0">
              {p.product_images?.[0]?.image_url ? <img src={p.product_images[0].image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package className="h-6 w-6" /></div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
              <p className="text-xs text-slate-400">{p.seller?.store_name} · {formatINR(p.selling_price)} · Stock: {p.stock}</p>
            </div>
            <Badge variant={p.status === 'approved' ? 'success' : p.status === 'pending' ? 'warning' : 'error'}>{p.status}</Badge>
            <div className="flex gap-1">
              {p.status === 'pending' && <>
                <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, 'approved')}><Check className="h-3.5 w-3.5 text-emerald-600" /></Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, 'rejected')}><X className="h-3.5 w-3.5 text-red-600" /></Button>
              </>}
              <Button size="sm" variant="ghost" onClick={() => toggleFlag(p.id, 'is_featured', p.is_featured)} className={p.is_featured ? 'text-rose-600' : ''}>★</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ CATEGORIES ============
function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', commission_pct: '10' });
  const { push } = useToast();

  const fetch = async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    setCategories(data || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const addCategory = async () => {
    if (!form.name) { push('error', 'Name is required'); return; }
    const { error } = await supabase.from('categories').insert({
      name: form.name,
      slug: form.slug || slugify(form.name),
      commission_pct: parseFloat(form.commission_pct) || 10,
    });
    if (error) { push('error', error.message); return; }
    push('success', 'Category added');
    setShowForm(false);
    setForm({ name: '', slug: '', commission_pct: '10' });
    fetch();
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Categories ({categories.length})</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4" /> Add Category</Button>
      </div>
      {showForm && (
        <Card className="p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Name"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Slug"><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated" /></Field>
            <Field label="Commission %"><Input type="number" value={form.commission_pct} onChange={e => setForm({ ...form, commission_pct: e.target.value })} /></Field>
          </div>
          <Button size="sm" onClick={addCategory}>Save Category</Button>
        </Card>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map(c => (
          <Card key={c.id} className="p-4 flex items-center justify-between">
            <div><p className="text-sm font-semibold text-slate-800">{c.name}</p><p className="text-xs text-slate-400">Commission: {c.commission_pct}%</p></div>
            <Badge variant={c.is_active ? 'success' : 'error'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ ORDERS ============
function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('orders').select('*, seller:seller_profiles(*), customer:profiles(*), order_items(*)').order('created_at', { ascending: false }).limit(100).then(({ data }) => { setOrders((data as any) || []); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">All Orders ({orders.length})</h1>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100 bg-slate-50"><th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Seller</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Commission</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Payment</th></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3"><p className="font-medium text-slate-800">{o.order_number}</p><p className="text-xs text-slate-400">{formatDate(o.created_at)}</p></td>
                  <td className="px-4 py-3 text-slate-600">{(o as any).customer?.full_name || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{o.seller?.store_name || '-'}</td>
                  <td className="px-4 py-3 font-semibold">{formatINR(o.total)}</td>
                  <td className="px-4 py-3 text-rose-600">{formatINR(o.commission_amount)}</td>
                  <td className="px-4 py-3"><Badge variant="info">{ORDER_STATUS_LABELS[o.status] || o.status}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={o.payment_status === 'paid' ? 'success' : 'warning'}>{o.payment_status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============ COMMISSIONS ============
function AdminCommissions() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalPct, setGlobalPct] = useState('10');
  const { push } = useToast();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('orders').select('*, seller:seller_profiles(store_name)').order('created_at', { ascending: false }).limit(100);
      setOrders((data as any) || []);
      const { data: setting } = await supabase.from('platform_settings').select('value').eq('key', 'global_commission_pct').maybeSingle();
      if (setting) setGlobalPct(setting.value);
      setLoading(false);
    })();
  }, []);

  const updateGlobal = async () => {
    await supabase.from('platform_settings').update({ value: globalPct }).eq('key', 'global_commission_pct');
    push('success', 'Global commission updated');
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  const totalCommission = orders.reduce((s, o) => s + o.commission_amount, 0);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Commission Management</h1>
      <Card className="p-5 mb-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Global Commission Rate</h3>
        <div className="flex gap-2 items-end">
          <Field label="Commission Percentage"><Input type="number" value={globalPct} onChange={e => setGlobalPct(e.target.value)} className="w-32" /></Field>
          <Button onClick={updateGlobal}>Update</Button>
        </div>
        <p className="text-xs text-slate-400 mt-2">This is the default commission. Category and seller-specific rates override this.</p>
      </Card>
      <Card className="p-4 mb-4 bg-gradient-to-r from-teal-50 to-emerald-50">
        <p className="text-xs text-slate-500">Total Platform Commission</p>
        <p className="text-2xl font-bold text-teal-600">{formatINR(totalCommission)}</p>
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Commission Ledger</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100"><th className="pb-2">Order</th><th className="pb-2">Seller</th><th className="pb-2">Order Total</th><th className="pb-2">Commission</th><th className="pb-2">Seller Amount</th><th className="pb-2">Date</th></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-slate-50">
                  <td className="py-2 text-slate-700">{o.order_number}</td>
                  <td className="py-2 text-slate-500">{o.seller?.store_name || '-'}</td>
                  <td className="py-2 text-slate-700">{formatINR(o.total)}</td>
                  <td className="py-2 font-semibold text-teal-600">{formatINR(o.commission_amount)}</td>
                  <td className="py-2 text-slate-700">{formatINR(o.seller_amount)}</td>
                  <td className="py-2 text-slate-400">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============ WITHDRAWALS ============
function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  const fetch = async () => {
    const { data } = await supabase.from('withdrawals').select('*, seller:seller_profiles(store_name)').order('created_at', { ascending: false });
    setWithdrawals(data || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('withdrawals').update({ status, processed_at: new Date().toISOString() }).eq('id', id);
    push('success', `Withdrawal ${status}`);
    fetch();
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Withdrawal Requests ({withdrawals.length})</h1>
      {withdrawals.length === 0 ? <EmptyState icon={<ArrowUpRight className="h-16 w-16" />} title="No withdrawal requests" /> : (
        <div className="space-y-3">
          {withdrawals.map(w => (
            <Card key={w.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{formatINR(w.amount)}</p>
                <p className="text-xs text-slate-400">{w.seller?.store_name} · {w.payout_method} · {formatDate(w.requested_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={w.status === 'paid' ? 'success' : w.status === 'rejected' ? 'error' : w.status === 'pending' ? 'warning' : 'info'}>{w.status}</Badge>
                {w.status === 'pending' && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => updateStatus(w.id, 'approved')}><Check className="h-3.5 w-3.5 text-emerald-600" /></Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(w.id, 'rejected')}><X className="h-3.5 w-3.5 text-red-600" /></Button>
                  </div>
                )}
                {w.status === 'approved' && <Button size="sm" onClick={() => updateStatus(w.id, 'paid')}>Mark Paid</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ PLANS ============
function AdminPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    supabase.from('subscription_plans').select('*').order('sort_order').then(({ data }) => { setPlans(data || []); setLoading(false); });
  }, []);

  const updatePlan = async (id: string, field: string, value: any) => {
    await supabase.from('subscription_plans').update({ [field]: value }).eq('id', id);
    push('success', 'Plan updated');
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Subscription Plans</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {plans.map(p => (
          <Card key={p.id} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
              <Badge variant={p.is_active ? 'success' : 'error'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div><label className="text-xs text-slate-500">Price (₹/mo)</label><Input type="number" defaultValue={p.price} onBlur={e => updatePlan(p.id, 'price', parseFloat(e.target.value))} className="mt-1" /></div>
            <div><label className="text-xs text-slate-500">Commission %</label><Input type="number" defaultValue={p.commission_pct} onBlur={e => updatePlan(p.id, 'commission_pct', parseFloat(e.target.value))} className="mt-1" /></div>
            <div><label className="text-xs text-slate-500">Product Limit</label><Input type="number" defaultValue={p.product_limit} onBlur={e => updatePlan(p.id, 'product_limit', parseInt(e.target.value))} className="mt-1" /></div>
            <Button size="sm" variant="outline" onClick={() => updatePlan(p.id, 'is_active', !p.is_active)}>{p.is_active ? 'Deactivate' : 'Activate'}</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ COUPONS ============
function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', description: '', discount_type: 'percentage', discount_value: '', min_order_value: '0', max_discount: '', ends_at: '' });
  const { push } = useToast();

  const fetch = async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons(data || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const create = async () => {
    if (!form.code || !form.discount_value) { push('error', 'Code and discount value required'); return; }
    const { error } = await supabase.from('coupons').insert({
      code: form.code.toUpperCase(),
      description: form.description,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      min_order_value: parseFloat(form.min_order_value) || 0,
      max_discount: form.max_discount ? parseFloat(form.max_discount) : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_active: true,
    });
    if (error) { push('error', error.message); return; }
    push('success', 'Coupon created');
    setShowForm(false);
    setForm({ code: '', description: '', discount_type: 'percentage', discount_value: '', min_order_value: '0', max_discount: '', ends_at: '' });
    fetch();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('coupons').update({ is_active: !current }).eq('id', id);
    fetch();
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Coupons ({coupons.length})</h1>
        <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4" /> New Coupon</Button>
      </div>
      {showForm && (
        <Card className="p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code"><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" /></Field>
            <Field label="Type"><Select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}><option value="percentage">Percentage</option><option value="fixed">Fixed</option></Select></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Discount Value"><Input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} /></Field>
            <Field label="Min Order ₹"><Input type="number" value={form.min_order_value} onChange={e => setForm({ ...form, min_order_value: e.target.value })} /></Field>
            <Field label="Max Discount ₹"><Input type="number" value={form.max_discount} onChange={e => setForm({ ...form, max_discount: e.target.value })} /></Field>
          </div>
          <Field label="Description"><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
          <Button size="sm" onClick={create}>Create Coupon</Button>
        </Card>
      )}
      <div className="space-y-2">
        {coupons.map(c => (
          <Card key={c.id} className="p-4 flex items-center justify-between">
            <div><p className="text-sm font-bold text-slate-800">{c.code}</p><p className="text-xs text-slate-400">{c.description} · {c.discount_type === 'percentage' ? `${c.discount_value}% off` : `${formatINR(c.discount_value)} off`} · Used {c.used_count}</p></div>
            <div className="flex items-center gap-2">
              <Badge variant={c.is_active ? 'success' : 'error'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
              <Button size="sm" variant="ghost" onClick={() => toggleActive(c.id, c.is_active)}>{c.is_active ? 'Deactivate' : 'Activate'}</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ REVIEWS ============
function AdminReviews() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    supabase.from('reviews').select('*, product:products(name), profiles!reviews_user_id_fkey(full_name)').order('created_at', { ascending: false }).limit(100).then(({ data }) => { setReviews(data || []); setLoading(false); });
  }, []);

  const toggleReported = async (id: string, current: boolean) => {
    await supabase.from('reviews').update({ is_reported: !current }).eq('id', id);
    push('success', 'Review updated');
    setReviews(prev => prev.map(r => r.id === id ? { ...r, is_reported: !current } : r));
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Reviews ({reviews.length})</h1>
      <div className="space-y-2">
        {reviews.map(r => (
          <Card key={r.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-4 w-4 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`} />)}</div>
                <span className="text-sm font-medium text-slate-700">{r.profiles?.full_name || 'Anonymous'}</span>
              </div>
              <Badge variant={r.is_reported ? 'error' : 'default'}>{r.is_reported ? 'Reported' : 'Normal'}</Badge>
            </div>
            <p className="text-sm text-slate-600">{r.body || r.title || 'No content'}</p>
            <p className="text-xs text-slate-400 mt-1">{r.product?.name} · {formatDate(r.created_at)}</p>
            <div className="mt-2"><Button size="sm" variant="ghost" onClick={() => toggleReported(r.id, r.is_reported)}>{r.is_reported ? 'Unreport' : 'Report'}</Button></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ SETTINGS ============
function AdminSettings() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    supabase.from('platform_settings').select('*').order('key').then(({ data }) => { setSettings(data || []); setLoading(false); });
  }, []);

  const update = async (id: string, value: string) => {
    await supabase.from('platform_settings').update({ value, updated_at: new Date().toISOString() }).eq('id', id);
    push('success', 'Setting updated');
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Platform Settings</h1>
      <Card className="p-5 space-y-4">
        {settings.map(s => (
          <div key={s.id} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{s.description || s.key}</label>
              <Input defaultValue={s.value} onBlur={e => update(s.id, e.target.value)} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
