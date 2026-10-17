import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRouter, Link, pathname } from '@/lib/router';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card, Badge, EmptyState, Spinner } from '@/components/ui/Common';
import { Select, Input, Textarea, Field } from '@/components/ui/Input';
import type { Product, Order, Wallet, WalletTransaction, Withdrawal, SubscriptionPlan, Subscription, SellerProfile, Category, Review } from '@/lib/types';
import { formatINR, formatDate, formatDateTime, ORDER_STATUS_LABELS, slugify } from '@/lib/utils';
import { LayoutDashboard, Package, ShoppingBag, DollarSign, Wallet as WalletIcon, Store, Ticket, Bell, HelpCircle, Plus, TrendingUp, ArrowUpRight, ArrowDownRight, Trash2, Edit, Check, X, Star, ChevronRight, Download, Upload, Clock } from 'lucide-react';

const NAV = [
  { label: 'Overview', icon: LayoutDashboard, path: '/seller' },
  { label: 'Add Product', icon: Plus, path: '/seller/add-product' },
  { label: 'My Products', icon: Package, path: '/seller/products' },
  { label: 'Orders', icon: ShoppingBag, path: '/seller/orders' },
  { label: 'Earnings', icon: DollarSign, path: '/seller/earnings' },
  { label: 'Wallet', icon: WalletIcon, path: '/seller/wallet' },
  { label: 'Withdrawals', icon: ArrowUpRight, path: '/seller/withdrawals' },
  { label: 'Reviews', icon: Star, path: '/seller/reviews' },
  { label: 'Store Profile', icon: Store, path: '/seller/store' },
  { label: 'Plans', icon: Ticket, path: '/seller/plans' },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
  { label: 'Support', icon: HelpCircle, path: '/support' },
];

export function SellerDashboard({ subpath }: { subpath: string }) {
  const { user, loading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { navigate('/login'); return; }
    if (!user) return;
    if (user.role !== 'seller' && user.role !== 'admin') { navigate('/'); return; }
    (async () => {
      const { data } = await supabase.from('seller_profiles').select('*').eq('user_id', user.id).maybeSingle();
      setSeller(data as any);
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><Spinner className="h-8 w-8" /></div>;
  if (!user) return null;
  if (!seller) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="p-8 max-w-md text-center">
          <Store className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800 mb-2">No seller profile found</h2>
          <Link to="/become-seller"><Button>Become a Seller</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden lg:block w-60 shrink-0">
            <div className="sticky top-20">
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                    <Store className="h-5 w-5 text-rose-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{seller.store_name}</p>
                    <Badge variant={seller.seller_status === 'active' ? 'success' : 'warning'}>{seller.seller_status}</Badge>
                  </div>
                </div>
                <nav className="space-y-0.5">
                  {NAV.map(item => {
                    const active = subpath === item.path || (item.path !== '/seller' && subpath.startsWith(item.path));
                    return (
                      <Link key={item.path} to={item.path} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-rose-50 text-rose-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </Card>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile nav */}
            <div className="lg:hidden mb-4 overflow-x-auto">
              <div className="flex gap-1 pb-1">
                {NAV.map(item => {
                  const active = subpath === item.path || (item.path !== '/seller' && subpath.startsWith(item.path));
                  return (
                    <Link key={item.path} to={item.path} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${active ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                      <item.icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {subpath === '/seller' && <SellerOverview seller={seller} />}
            {subpath === '/seller/add-product' && <AddProduct seller={seller} />}
            {subpath === '/seller/products' && <SellerProducts seller={seller} />}
            {subpath === '/seller/orders' && <SellerOrders seller={seller} />}
            {subpath === '/seller/earnings' && <SellerEarnings seller={seller} />}
            {subpath === '/seller/wallet' && <SellerWallet seller={seller} />}
            {subpath === '/seller/withdrawals' && <SellerWithdrawals seller={seller} />}
            {subpath === '/seller/reviews' && <SellerReviews seller={seller} />}
            {subpath === '/seller/store' && <StoreProfile seller={seller} />}
            {subpath === '/seller/plans' && <SellerPlans seller={seller} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ OVERVIEW ============
function SellerOverview({ seller }: { seller: SellerProfile }) {
  const [stats, setStats] = useState({ products: 0, pending: 0, orders: 0, revenue: 0, wallet: null as Wallet | null, recentOrders: [] as Order[] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [prodRes, pendRes, ordRes, walletRes, recentRes] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('seller_id', seller.id),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('seller_id', seller.id).eq('status', 'pending'),
        supabase.from('orders').select('id, total', { count: 'exact' }).eq('seller_id', seller.id).neq('status', 'cancelled'),
        supabase.from('wallets').select('*').eq('seller_id', seller.id).maybeSingle(),
        supabase.from('orders').select('*, order_items(*)').eq('seller_id', seller.id).order('created_at', { ascending: false }).limit(5),
      ]);
      const revenue = (ordRes.data || []).reduce((s: number, o: any) => s + o.total, 0);
      setStats({ products: prodRes.count || 0, pending: pendRes.count || 0, orders: ordRes.count || 0, revenue, wallet: walletRes.data as any, recentOrders: (recentRes.data as any) || [] });
      setLoading(false);
    })();
  }, [seller.id]);

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  const statCards = [
    { label: 'Total Products', value: stats.products, icon: Package, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pending Approval', value: stats.pending, icon: Clock, color: 'bg-amber-50 text-amber-600' },
    { label: 'Total Orders', value: stats.orders, icon: ShoppingBag, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Total Revenue', value: formatINR(stats.revenue), icon: DollarSign, color: 'bg-rose-50 text-rose-600' },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Dashboard Overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s, i) => (
          <Card key={i} className="p-4">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mb-3`}>
              <s.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </Card>
        ))}
      </div>

      {stats.wallet && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Wallet Balance</h3>
            <Link to="/seller/wallet"><Button size="sm" variant="outline">View Details</Button></Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div><p className="text-xs text-slate-500">Available</p><p className="text-lg font-bold text-emerald-600">{formatINR(stats.wallet.available_balance)}</p></div>
            <div><p className="text-xs text-slate-500">Pending</p><p className="text-lg font-bold text-amber-600">{formatINR(stats.wallet.pending_balance)}</p></div>
            <div><p className="text-xs text-slate-500">Total Earnings</p><p className="text-lg font-bold text-slate-900">{formatINR(stats.wallet.total_earnings)}</p></div>
            <div><p className="text-xs text-slate-500">Commission Paid</p><p className="text-lg font-bold text-rose-600">{formatINR(stats.wallet.total_commission)}</p></div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent Orders</h3>
        {stats.recentOrders.length === 0 ? (
          <EmptyState icon={<ShoppingBag className="h-12 w-12" />} title="No orders yet" message="Orders will appear here once customers buy your products." />
        ) : (
          <div className="space-y-2">
            {stats.recentOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-800">{o.order_number}</p>
                  <p className="text-xs text-slate-400">{formatDate(o.created_at)} · {o.order_items?.length || 0} items</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{formatINR(o.total)}</span>
                  <Badge variant="info">{ORDER_STATUS_LABELS[o.status] || o.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ ADD PRODUCT ============
function AddProduct({ seller }: { seller: SellerProfile }) {
  const { push } = useToast();
  const { navigate } = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', category_id: '', brand: '', description: '', mrp: '', selling_price: '', stock: '', sku: '', weight: '', shipping_info: '', return_policy: '7 Days Easy Returns',
  });
  const [images, setImages] = useState<string[]>(['']);

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_active', true).order('name').then(({ data }) => setCategories(data || []));
  }, []);

  const submit = async () => {
    if (!form.name || !form.selling_price || !form.category_id) { push('error', 'Please fill required fields'); return; }
    setLoading(true);
    try {
      const slug = `${slugify(form.name)}-${Date.now().toString(36)}`;
      const { data: product, error } = await supabase.from('products').insert({
        seller_id: seller.id,
        category_id: form.category_id,
        name: form.name,
        slug,
        brand: form.brand || null,
        description: form.description,
        mrp: parseFloat(form.mrp) || parseFloat(form.selling_price),
        selling_price: parseFloat(form.selling_price),
        stock: parseInt(form.stock) || 0,
        sku: form.sku || null,
        weight: form.weight ? parseFloat(form.weight) : null,
        shipping_info: form.shipping_info || null,
        return_policy: form.return_policy,
        status: 'pending',
      }).select().single();

      if (error) throw error;

      // Insert images
      const validImages = images.filter(i => i.trim());
      if (validImages.length > 0 && product) {
        await supabase.from('product_images').insert(validImages.map((url, i) => ({ product_id: product.id, image_url: url, sort_order: i })));
      }

      push('success', 'Product submitted for approval!');
      navigate('/seller/products');
    } catch (err: any) {
      push('error', err.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Add New Product</h1>
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Product Name *"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cotton T-Shirt" /></Field>
          <Field label="Brand"><Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="e.g. Trendz" /></Field>
        </div>
        <Field label="Category *">
          <Select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Select category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Description"><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe your product..." /></Field>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="MRP (₹)"><Input type="number" value={form.mrp} onChange={e => setForm({ ...form, mrp: e.target.value })} placeholder="999" /></Field>
          <Field label="Selling Price (₹) *"><Input type="number" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} placeholder="499" /></Field>
          <Field label="Stock Quantity"><Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="100" /></Field>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="SKU"><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="TRZ-001" /></Field>
          <Field label="Weight (kg)"><Input type="number" step="0.01" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} placeholder="0.2" /></Field>
          <Field label="Return Policy"><Input value={form.return_policy} onChange={e => setForm({ ...form, return_policy: e.target.value })} /></Field>
        </div>
        <Field label="Shipping Information"><Input value={form.shipping_info} onChange={e => setForm({ ...form, shipping_info: e.target.value })} placeholder="Ships in 2-3 days" /></Field>

        {/* Images */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Product Images (URLs)</label>
          <div className="space-y-2">
            {images.map((img, i) => (
              <div key={i} className="flex gap-2">
                <Input value={img} onChange={e => setImages(prev => prev.map((x, j) => j === i ? e.target.value : x))} placeholder="https://example.com/image.jpg" />
                {images.length > 1 && <Button variant="ghost" size="sm" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>}
              </div>
            ))}
          </div>
          <button onClick={() => setImages(prev => [...prev, ''])} className="mt-2 text-sm text-rose-600 font-medium hover:underline">+ Add another image</button>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={submit} loading={loading}>Submit for Approval</Button>
          <Button variant="ghost" onClick={() => navigate('/seller/products')}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}

// ============ MY PRODUCTS ============
function SellerProducts({ seller }: { seller: SellerProfile }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { push } = useToast();

  const fetch = async () => {
    const { data } = await supabase.from('products').select('*, category:categories(*), product_images(*)').eq('seller_id', seller.id).order('created_at', { ascending: false });
    setProducts((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, [seller.id]);

  const filtered = filter === 'all' ? products : filter === 'pending' ? products.filter(p => p.status === 'pending') : filter === 'approved' ? products.filter(p => p.status === 'approved') : products.filter(p => p.status === 'rejected');

  const deleteProduct = async (id: string) => {
    if (!confirm('Archive this product? It will be hidden from the store. You can reactivate it later.')) return;
    const { error } = await supabase.from('products').update({ status: 'disabled' }).eq('id', id);
    if (error) { push('error', error.message); return; }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, status: 'disabled' as any } : p));
    push('success', 'Product archived');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">My Products ({products.length})</h1>
        <Link to="/seller/add-product"><Button size="sm"><Plus className="h-4 w-4" /> Add Product</Button></Link>
      </div>
      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{f}</button>
        ))}
      </div>
      {loading ? <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div> :
      filtered.length === 0 ? (
        <EmptyState icon={<Package className="h-16 w-16" />} title="No products yet" message="Add your first product to start selling." action={<Link to="/seller/add-product"><Button>Add Product</Button></Link>} />
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <Card key={p.id} className="p-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                {p.product_images?.[0]?.image_url ? <img src={p.product_images[0].image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package className="h-6 w-6" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                <p className="text-xs text-slate-400">{p.category?.name} · {formatINR(p.selling_price)} · Stock: {p.stock}</p>
                {p.status === 'rejected' && p.rejection_reason && <p className="text-xs text-red-600 mt-0.5">Reason: {p.rejection_reason}</p>}
              </div>
              <Badge variant={p.status === 'approved' ? 'success' : p.status === 'pending' ? 'warning' : p.status === 'rejected' ? 'error' : 'default'}>{p.status}</Badge>
              <button onClick={() => deleteProduct(p.id)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ SELLER ORDERS ============
function SellerOrders({ seller }: { seller: SellerProfile }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  const fetch = async () => {
    const { data } = await supabase.from('orders').select('*, order_items(*), customer:profiles(id, full_name, phone)').eq('seller_id', seller.id).order('created_at', { ascending: false });
    setOrders((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, [seller.id]);

  const updateStatus = async (orderId: string, status: string) => {
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
    push('success', 'Order status updated');
    fetch();
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Orders ({orders.length})</h1>
      {orders.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-16 w-16" />} title="No orders yet" message="When customers buy your products, orders will appear here." />
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <Card key={o.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{o.order_number}</p>
                  <p className="text-xs text-slate-400">{formatDate(o.created_at)} · {(o as any).customer?.full_name || 'Customer'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{formatINR(o.total)}</span>
                  <Badge variant={o.payment_status === 'paid' ? 'success' : 'warning'}>{o.payment_status}</Badge>
                </div>
              </div>
              <div className="space-y-1.5 mb-3">
                {o.order_items?.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="w-8 h-8 rounded bg-slate-100 overflow-hidden shrink-0">
                      {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <span className="flex-1 truncate">{item.product_name} × {item.quantity}</span>
                    <span>{formatINR(item.total_price)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <Select value={o.status} onChange={e => updateStatus(o.id, e.target.value)} className="w-auto text-xs py-1.5">
                  <option value="pending">Payment Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="packed">Packed</option>
                  <option value="shipped">Shipped</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ EARNINGS ============
function SellerEarnings({ seller }: { seller: SellerProfile }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('orders').select('*, order_items(*)').eq('seller_id', seller.id).order('created_at', { ascending: false }).then(({ data }) => { setOrders((data as any) || []); setLoading(false); });
  }, [seller.id]);

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.subtotal, 0);
  const totalCommission = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.commission_amount, 0);
  const netEarnings = totalRevenue - totalCommission;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Earnings & Commission</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4"><div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3"><DollarSign className="h-5 w-5 text-emerald-600" /></div><p className="text-2xl font-bold text-slate-900">{formatINR(totalRevenue)}</p><p className="text-xs text-slate-500">Gross Revenue</p></Card>
        <Card className="p-4"><div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center mb-3"><TrendingUp className="h-5 w-5 text-rose-600" /></div><p className="text-2xl font-bold text-slate-900">{formatINR(totalCommission)}</p><p className="text-xs text-slate-500">Platform Commission</p></Card>
        <Card className="p-4"><div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3"><WalletIcon className="h-5 w-5 text-blue-600" /></div><p className="text-2xl font-bold text-slate-900">{formatINR(netEarnings)}</p><p className="text-xs text-slate-500">Net Earnings</p></Card>
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Transaction Ledger</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100"><th className="pb-2">Order</th><th className="pb-2">Date</th><th className="pb-2">Gross</th><th className="pb-2">Commission</th><th className="pb-2">Net</th><th className="pb-2">Status</th></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-slate-50">
                  <td className="py-2 text-slate-700">{o.order_number}</td>
                  <td className="py-2 text-slate-500">{formatDate(o.created_at)}</td>
                  <td className="py-2 text-slate-700">{formatINR(o.subtotal)}</td>
                  <td className="py-2 text-rose-600">-{formatINR(o.commission_amount)}</td>
                  <td className="py-2 font-semibold text-slate-900">{formatINR(o.seller_amount)}</td>
                  <td className="py-2"><Badge variant="info">{ORDER_STATUS_LABELS[o.status] || o.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============ WALLET ============
function SellerWallet({ seller }: { seller: SellerProfile }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [wRes, tRes] = await Promise.all([
        supabase.from('wallets').select('*').eq('seller_id', seller.id).maybeSingle(),
        supabase.from('wallet_transactions').select('*').eq('seller_id', seller.id).order('created_at', { ascending: false }).limit(50),
      ]);
      setWallet(wRes.data as any);
      setTransactions((tRes.data as any) || []);
      setLoading(false);
    })();
  }, [seller.id]);

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Wallet & Ledger</h1>
      {wallet && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4"><p className="text-xs text-slate-500">Available Balance</p><p className="text-xl font-bold text-emerald-600">{formatINR(wallet.available_balance)}</p></Card>
          <Card className="p-4"><p className="text-xs text-slate-500">Pending Balance</p><p className="text-xl font-bold text-amber-600">{formatINR(wallet.pending_balance)}</p></Card>
          <Card className="p-4"><p className="text-xs text-slate-500">Total Earnings</p><p className="text-xl font-bold text-slate-900">{formatINR(wallet.total_earnings)}</p></Card>
          <Card className="p-4"><p className="text-xs text-slate-500">Total Withdrawn</p><p className="text-xl font-bold text-slate-900">{formatINR(wallet.total_withdrawn)}</p></Card>
        </div>
      )}
      <div className="flex gap-2 mb-4">
        <Link to="/seller/withdrawals" className="flex-1"><Button className="w-full"><ArrowUpRight className="h-4 w-4" /> Request Withdrawal</Button></Link>
      </div>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Transaction History</h3>
        {transactions.length === 0 ? (
          <EmptyState icon={<WalletIcon className="h-12 w-12" />} title="No transactions yet" message="Your wallet transactions will appear here." />
        ) : (
          <div className="space-y-2">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t.description || t.type}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(t.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${t.type === 'credit' || t.type === 'adjustment' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.type === 'credit' || t.type === 'adjustment' ? '+' : '-'}{formatINR(t.amount)}
                  </p>
                  <p className="text-xs text-slate-400">Bal: {formatINR(t.balance_after)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ WITHDRAWALS ============
function SellerWithdrawals({ seller }: { seller: SellerProfile }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', payout_method: 'upi', upi_id: '', bank_name: '', account_number: '', ifsc: '' });
  const [submitting, setSubmitting] = useState(false);
  const { push } = useToast();

  const fetch = async () => {
    const [wRes, wdRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('seller_id', seller.id).maybeSingle(),
      supabase.from('withdrawals').select('*').eq('seller_id', seller.id).order('created_at', { ascending: false }),
    ]);
    setWallet(wRes.data as any);
    setWithdrawals((wdRes.data as any) || []);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, [seller.id]);

  const submit = async () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt < 500) { push('error', 'Minimum withdrawal is ₹500'); return; }
    if (wallet && amt > wallet.available_balance) { push('error', 'Insufficient balance'); return; }
    setSubmitting(true);
    try {
      const payoutDetails: any = form.payout_method === 'upi' ? { upi_id: form.upi_id } : { bank_name: form.bank_name, account_number: form.account_number, ifsc: form.ifsc };
      const { error } = await supabase.rpc('request_payout', {
        p_amount: amt,
        p_method: form.payout_method,
        p_details: payoutDetails,
      });
      if (error) throw error;
      push('success', 'Withdrawal request submitted!');
      setShowForm(false);
      setForm({ amount: '', payout_method: 'upi', upi_id: '', bank_name: '', account_number: '', ifsc: '' });
      fetch();
    } catch (err: any) {
      push('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Withdrawals</h1>
        {!showForm && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New Withdrawal</Button>}
      </div>
      {wallet && (
        <Card className="p-4 mb-4 bg-gradient-to-r from-emerald-50 to-teal-50">
          <p className="text-xs text-slate-500">Available for Withdrawal</p>
          <p className="text-2xl font-bold text-emerald-600">{formatINR(wallet.available_balance)}</p>
        </Card>
      )}
      {showForm && (
        <Card className="p-5 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">New Withdrawal Request</h3>
          <Field label="Amount (₹) *"><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="500" /></Field>
          <Field label="Payout Method">
            <Select value={form.payout_method} onChange={e => setForm({ ...form, payout_method: e.target.value })}>
              <option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option>
            </Select>
          </Field>
          {form.payout_method === 'upi' && <Field label="UPI ID"><Input value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} placeholder="name@bank" /></Field>}
          {form.payout_method === 'bank_transfer' && (
            <>
              <Field label="Bank Name"><Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Account Number"><Input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} /></Field>
                <Field label="IFSC"><Input value={form.ifsc} onChange={e => setForm({ ...form, ifsc: e.target.value })} /></Field>
              </div>
            </>
          )}
          <div className="flex gap-2">
            <Button onClick={submit} loading={submitting}>Submit Request</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}
      {withdrawals.length === 0 && !showForm ? (
        <EmptyState icon={<ArrowUpRight className="h-16 w-16" />} title="No withdrawal requests" message="Request a withdrawal when you have available balance." action={<Button onClick={() => setShowForm(true)}>New Withdrawal</Button>} />
      ) : (
        <div className="space-y-2">
          {withdrawals.map(w => (
            <Card key={w.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{formatINR(w.amount)}</p>
                <p className="text-xs text-slate-400">{formatDate(w.requested_at)} · {w.payout_method}</p>
              </div>
              <Badge variant={w.status === 'paid' ? 'success' : w.status === 'rejected' ? 'error' : w.status === 'pending' ? 'warning' : 'info'}>{w.status}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ REVIEWS ============
function SellerReviews({ seller }: { seller: SellerProfile }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: products } = await supabase.from('products').select('id').eq('seller_id', seller.id);
      if (!products || products.length === 0) { setLoading(false); return; }
      const productIds = products.map(p => p.id);
      const { data } = await supabase.from('reviews').select('*, product:products(name)').in('product_id', productIds).order('created_at', { ascending: false }).limit(50);
      setReviews(data || []);
      setLoading(false);
    })();
  }, [seller.id]);

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Product Reviews</h1>
      {reviews.length === 0 ? (
        <EmptyState icon={<Star className="h-16 w-16" />} title="No reviews yet" message="Customer reviews on your products will appear here." />
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-sm font-semibold text-rose-700">{r.reviewer_name?.charAt(0).toUpperCase() || 'U'}</div>
                  <div><p className="text-sm font-medium text-slate-800">{r.reviewer_name || 'Anonymous'}</p><p className="text-xs text-slate-400">{r.product?.name} · {formatDate(r.created_at)}</p></div>
                </div>
                <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-4 w-4 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`} />)}</div>
              </div>
              {r.title && <p className="text-sm font-semibold text-slate-800">{r.title}</p>}
              {r.body && <p className="text-sm text-slate-600">{r.body}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ STORE PROFILE ============
function StoreProfile({ seller }: { seller: SellerProfile }) {
  const [form, setForm] = useState({ store_name: seller.store_name, description: seller.description || '', store_logo: seller.store_logo || '', store_banner: seller.store_banner || '' });
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('seller_profiles').update({
      store_name: form.store_name,
      description: form.description,
      store_logo: form.store_logo || null,
      store_banner: form.store_banner || null,
    }).eq('id', seller.id);
    if (error) { push('error', error.message); } else { push('success', 'Store profile updated'); }
    setSaving(false);
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Store Profile</h1>
      <Card className="p-5 space-y-4 max-w-lg">
        <Field label="Store Name"><Input value={form.store_name} onChange={e => setForm({ ...form, store_name: e.target.value })} /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></Field>
        <Field label="Logo URL"><Input value={form.store_logo} onChange={e => setForm({ ...form, store_logo: e.target.value })} placeholder="https://..." /></Field>
        <Field label="Banner URL"><Input value={form.store_banner} onChange={e => setForm({ ...form, store_banner: e.target.value })} placeholder="https://..." /></Field>
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div><p className="text-xs text-slate-500 mb-1">KYC Status</p><Badge variant={seller.kyc_status === 'verified' ? 'success' : 'warning'}>{seller.kyc_status}</Badge></div>
          <div><p className="text-xs text-slate-500 mb-1">Seller Status</p><Badge variant={seller.seller_status === 'active' ? 'success' : 'warning'}>{seller.seller_status}</Badge></div>
        </div>
        <Button onClick={save} loading={saving}>Save Changes</Button>
      </Card>
    </div>
  );
}

// ============ PLANS ============
function SellerPlans({ seller }: { seller: SellerProfile }) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [pRes, sRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('subscriptions').select('*, plan:subscription_plans(*)').eq('seller_id', seller.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setPlans(pRes.data || []);
      setCurrentSub(sRes.data as any);
      setLoading(false);
    })();
  }, [seller.id]);

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Subscription Plans</h1>
      {currentSub && (
        <Card className="p-4 mb-6 bg-gradient-to-r from-rose-50 to-amber-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Current Plan</p>
              <p className="text-lg font-bold text-slate-900">{currentSub.plan?.name}</p>
              <p className="text-xs text-slate-500">Renews on {currentSub.renews_at ? formatDate(currentSub.renews_at) : 'N/A'}</p>
            </div>
            <Badge variant="success">Active</Badge>
          </div>
        </Card>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {plans.map(p => {
          const isCurrent = currentSub?.plan_id === p.id;
          return (
            <Card key={p.id} className={`p-5 ${p.slug === 'pro' ? 'border-rose-300 ring-2 ring-rose-500/20' : ''}`}>
              {p.slug === 'pro' && <div className="text-center mb-2"><Badge variant="rose">Most Popular</Badge></div>}
              <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatINR(p.price)}<span className="text-sm font-normal text-slate-400">/mo</span></p>
              <p className="text-xs text-slate-500 mt-1">Commission: {p.commission_pct}%</p>
              <ul className="mt-3 space-y-1.5">
                {p.features.map((f: string) => <li key={f} className="flex items-start gap-2 text-sm text-slate-600"><Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> {f}</li>)}
              </ul>
              <Button className="w-full mt-4" variant={isCurrent ? 'outline' : 'primary'} disabled={isCurrent}>{isCurrent ? 'Current Plan' : `Switch to ${p.name}`}</Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
