import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Order, WishlistItem, Address, Notification, Product, Coupon, Referral } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useRouter, Link, parseQuery, pathname } from '@/lib/router';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card, Badge, EmptyState } from '@/components/ui/Common';
import { ProductCard } from '@/components/ProductCard';
import { formatINR, formatDate, formatDateTime, timeAgo, ORDER_STATUS_LABELS, orderProgress, ORDER_STATUS_FLOW } from '@/lib/utils';
import { Package, Heart, MapPin, Bell, User, Ticket, Users, HelpCircle, Plus, Trash2, Check, ChevronRight, Truck, CheckCircle2, Clock, X, ShoppingBag, Copy } from 'lucide-react';

// ============ ORDERS ============
export function OrdersPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    (async () => {
      const { data } = await supabase.from('orders').select('*, seller:seller_profiles(*), order_items(*)').eq('customer_id', user.id).order('created_at', { ascending: false });
      setOrders((data as any) || []);
      setLoading(false);
    })();
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">My Orders</h1>
        {loading ? <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" /></div> :
        orders.length === 0 ? (
          <EmptyState icon={<Package className="h-16 w-16" />} title="No orders yet" message="When you place orders, they'll appear here." action={<Link to="/"><Button>Start Shopping</Button></Link>} />
        ) : (
          <div className="space-y-4">
            {orders.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const { navigate } = useRouter();
  const status = order.status;
  const progress = orderProgress(status);
  const statusColor = status === 'delivered' || status === 'completed' ? 'success' : status === 'cancelled' ? 'error' : 'info';

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{order.order_number}</p>
          <p className="text-xs text-slate-400">{formatDate(order.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusColor as any}>{ORDER_STATUS_LABELS[status] || status}</Badge>
          <Badge variant={order.payment_status === 'paid' ? 'success' : 'warning'}>{order.payment_status}</Badge>
        </div>
      </div>
      <div className="p-4">
        <div className="flex gap-3 mb-3">
          {order.order_items?.slice(0, 3).map(item => (
            <div key={item.id} className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
              {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
            </div>
          ))}
          {order.order_items && order.order_items.length > 3 && (
            <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-sm text-slate-500">+{order.order_items.length - 3}</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700 line-clamp-1">{order.order_items?.[0]?.product_name}{order.order_items && order.order_items.length > 1 ? ` and ${order.order_items.length - 1} more` : ''}</p>
            <p className="text-xs text-slate-400 mt-0.5">{order.seller?.store_name}</p>
          </div>
          <div className="text-right">
            <p className="text-base font-bold text-slate-900">{formatINR(order.total)}</p>
            <p className="text-xs text-slate-400">{order.order_items?.length} items</p>
          </div>
        </div>

        {/* Progress bar */}
        {status !== 'cancelled' && status !== 'pending' && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Order Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`/orders/${order.id}`)}>Track Order</Button>
          {order.payment_status === 'pending' && <Button size="sm">Pay Now</Button>}
        </div>
      </div>
    </Card>
  );
}

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
    const { push } = useToast();
  const [cancelling, setCancelling] = useState(false);
  const cancelPaidOrder = async () => {
    if (!order || cancelling) return;
    if (order.status !== 'cancelled' && !window.confirm('Cancel this order and get a full refund?')) return;
    setCancelling(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Please sign in again');
      const r = await fetch('/api/pay/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: order.id, reason: 'Cancelled by customer' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not cancel the order');
      push('success', 'Order cancelled. Your refund has been started.');
      setOrder({ ...order, status: 'cancelled', payment_status: 'refunded' } as any);
    } catch (e: any) {
      push('error', e.message || 'Could not cancel the order');
    } finally {
      setCancelling(false);
    }
  };
  const cancelOrder = async () => {
    if (!order || cancelling) return;
    const reason = window.prompt('Why do you want to cancel this order? (optional)');
    if (reason === null) return;
    setCancelling(true);
    const { error } = await supabase.rpc('customer_cancel_order', {
      p_order: order.id,
      p_reason: reason || 'Cancelled by customer',
    });
    setCancelling(false);
    if (error) { push('error', error.message); return; }
    push('success', 'Order cancelled');
    setOrder({ ...order, status: 'cancelled' } as any);
  };
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    (async () => {
      const { data } = await supabase.from('orders').select('*, seller:seller_profiles(*), order_items(*)').eq('id', orderId).eq('customer_id', user.id).maybeSingle();
      setOrder(data as any);
      setLoading(false);
    })();
  }, [orderId, user, navigate]);

  if (!user) return null;
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" /></div>;
  if (!order) return <EmptyState title="Order not found" />;

  const status = order.status;
  const currentStep = ORDER_STATUS_FLOW.indexOf(status);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button onClick={() => navigate('/orders')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-rose-600 mb-4">
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to Orders
        </button>

        <Card className="p-5 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h1 className="text-lg font-bold text-slate-900">{order.order_number}</h1>
              <p className="text-sm text-slate-400">Placed on {formatDateTime(order.created_at)}</p>
            </div>
            <Badge variant={status === 'delivered' || status === 'completed' ? 'success' : status === 'cancelled' ? 'error' : 'info'}>
              {ORDER_STATUS_LABELS[status] || status}
            </Badge>
          </div>

          {/* Tracking */}
          {status !== 'cancelled' && status !== 'pending' && (
            <div className="flex items-center justify-between mb-6 mt-6 px-2">
              {ORDER_STATUS_FLOW.slice(0, 7).map((step, i) => {
                const done = i <= currentStep;
                const isLast = i === ORDER_STATUS_FLOW.slice(0, 7).length - 1;
                return (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${done ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                        {done ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </div>
                      <span className={`text-[10px] font-medium ${done ? 'text-rose-600' : 'text-slate-400'}`}>{ORDER_STATUS_LABELS[step]}</span>
                    </div>
                    {!isLast && <div className={`flex-1 h-0.5 mx-1 ${i < currentStep ? 'bg-rose-500' : 'bg-slate-200'}`} />}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        
       {(order as any).tracking_number && ['shipped', 'out_for_delivery', 'delivered', 'completed'].includes(order.status) && (
          <Card className="p-4 mb-4 text-sm text-slate-600">
            Courier: <b>{(order as any).courier}</b> · Tracking number: <b>{(order as any).tracking_number}</b>
          </Card>
        )}
        {['pending', 'confirmed', 'processing'].includes(order.status) && order.payment_status !== 'paid' && (
          <Card className="p-4 mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">Changed your mind? You can cancel until the seller packs your order.</p>
            <Button size="sm" variant="outline" loading={cancelling} onClick={cancelOrder}>Cancel Order</Button>
          </Card>
        )}
        {['confirmed', 'processing'].includes(order.status) && order.payment_status === 'paid' && (
          <Card className="p-4 mb-4 text-sm text-slate-600">
              <span className="flex items-center justify-between gap-3">
              <span>This order is already paid. If you cancel it, the full amount is refunded to your original payment method (5-7 working days).</span>
              <Button size="sm" variant="outline" loading={cancelling} onClick={cancelPaidOrder}>Cancel &amp; Refund</Button>
            </span>
          </Card>
        )}
        
         {order.status === 'cancelled' && order.payment_status === 'paid' && order.payment_method === 'online' && (
          <Card className="p-4 mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">Your order is cancelled, but the refund has not gone through yet.</p>
            <Button size="sm" loading={cancelling} onClick={cancelPaidOrder}>Retry Refund</Button>
          </Card>
        )}
        {order.payment_status === 'refunded' && (
          <Card className="p-4 mb-4 text-sm text-emerald-700 bg-emerald-50">
            Refund of {formatINR(order.total)} has been sent to your original payment method. It can take 5-7 working days to show.
          </Card>
        )}
       
        {/* Items */}
        <Card className="p-5 mb-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Items in this order</h3>
          <div className="space-y-3">
            {order.order_items?.map(item => (
              <div key={item.id} className="flex gap-3">
                <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                  {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{item.product_name}</p>
                  <p className="text-xs text-slate-400">Qty: {item.quantity} × {formatINR(item.unit_price)}</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">{formatINR(item.total_price)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span>{formatINR(order.shipping_charge)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{formatINR(order.discount)}</span></div>}
            <div className="flex justify-between font-bold text-base pt-1"><span className="text-slate-900">Total</span><span className="text-rose-600">{formatINR(order.total)}</span></div>
          </div>
        </Card>

        {/* Address */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Delivery Address</h3>
          {order.shipping_address && (
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">{order.shipping_address.full_name} · {order.shipping_address.phone}</p>
              <p>{order.shipping_address.line1}{order.shipping_address.line2 ? `, ${order.shipping_address.line2}` : ''}</p>
              <p>{order.shipping_address.city}, {order.shipping_address.state} - {order.shipping_address.pincode}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============ WISHLIST ============
export function WishlistPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    (async () => {
      const { data } = await supabase.from('wishlist').select('*, product:products(*, product_images(*))').eq('user_id', user.id).order('created_at', { ascending: false });
      setItems((data as any) || []);
      setLoading(false);
    })();
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">My Wishlist ({items.length})</h1>
        {loading ? <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" /></div> :
        items.length === 0 ? (
          <EmptyState icon={<Heart className="h-16 w-16" />} title="Your wishlist is empty" message="Save items you love to your wishlist." action={<Link to="/"><Button>Browse Products</Button></Link>} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {items.map(item => item.product && <ProductCard key={item.id} product={item.product} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ ADDRESSES ============
export function AddressesPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const { push } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).then(({ data }) => setAddresses(data || []));
  }, [user, navigate]);

  const save = async () => {
    if (!user) return;
    const { data } = await supabase.from('addresses').insert({ ...form, user_id: user.id }).select().single();
    if (data) {
      setAddresses(prev => [...prev, data as Address]);
      setShowForm(false);
      setForm({ full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
      push('success', 'Address saved');
    }
  };

  const remove = async (id: string) => {
    await supabase.from('addresses').delete().eq('id', id);
    setAddresses(prev => prev.filter(a => a.id !== id));
    push('info', 'Address removed');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-900">Saved Addresses</h1>
          {!showForm && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Add New</Button>}
        </div>
        {showForm && (
          <Card className="p-5 mb-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">New Address</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Full Name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <input placeholder="Address Line 1" value={form.line1} onChange={e => setForm({ ...form, line1: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input placeholder="Address Line 2 (optional)" value={form.line2} onChange={e => setForm({ ...form, line2: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <div className="grid grid-cols-3 gap-3">
                <input placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input placeholder="State" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input placeholder="Pincode" value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={save}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        )}
        {addresses.length === 0 && !showForm ? (
          <EmptyState icon={<MapPin className="h-16 w-16" />} title="No saved addresses" message="Add a delivery address for faster checkout." action={<Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Add Address</Button>} />
        ) : (
          <div className="space-y-3">
            {addresses.map(a => (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.full_name} <span className="text-slate-400">· {a.phone}</span></p>
                    <p className="text-sm text-slate-500 mt-1">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} - {a.pincode}</p>
                    {a.is_default && <Badge variant="rose" >Default</Badge>}
                  </div>
                  <button onClick={() => remove(a.id)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ NOTIFICATIONS ============
export function NotificationsPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    (async () => {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setNotifications(data || []);
      // Mark all as read
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      setLoading(false);
    })();
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Notifications</h1>
        {loading ? <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" /></div> :
        notifications.length === 0 ? (
          <EmptyState icon={<Bell className="h-16 w-16" />} title="No notifications" message="You'll see updates about your orders here." />
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <Card key={n.id} className={`p-4 ${!n.is_read ? 'border-rose-200' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                    <Bell className="h-4 w-4 text-rose-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{n.title}</p>
                    {n.body && <p className="text-sm text-slate-500 mt-0.5">{n.body}</p>}
                    <p className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ PROFILE ============
export function ProfilePage() {
  const { user, signOut } = useAuth();
  const { navigate } = useRouter();
  const [profile, setProfile] = useState(user);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    setProfile(user);
  }, [user, navigate]);

  if (!user || !profile) return null;

  const menuItems = [
    { icon: Package, label: 'My Orders', to: '/orders' },
    { icon: Heart, label: 'Wishlist', to: '/wishlist' },
    { icon: MapPin, label: 'Addresses', to: '/addresses' },
    { icon: Bell, label: 'Notifications', to: '/notifications' },
    { icon: Ticket, label: 'Coupons', to: '/coupons' },
    { icon: Users, label: 'Referrals', to: '/referrals' },
    { icon: HelpCircle, label: 'Support', to: '/support' },
  ];

  if (user.role === 'seller') menuItems.push({ icon: ShoppingBag, label: 'Seller Dashboard', to: '/seller' });
  if (user.role === 'admin') menuItems.push({ icon: ShoppingBag, label: 'Admin Dashboard', to: '/admin' });

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Profile header */}
        <Card className="p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center text-2xl font-bold text-rose-700">
              {profile.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{profile.full_name}</h1>
              <p className="text-sm text-slate-500 capitalize">{profile.role}</p>
              <p className="text-xs text-slate-400 mt-0.5">Referral Code: {profile.referral_code}</p>
            </div>
          </div>
        </Card>

        {/* Menu */}
        <div className="space-y-2">
          {menuItems.map((item, i) => (
            <Link key={i} to={item.to}>
              <Card className="p-4 flex items-center gap-3 hover:border-rose-200 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-rose-600" />
                </div>
                <span className="flex-1 text-sm font-medium text-slate-700">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Card>
            </Link>
          ))}
          <button onClick={() => { signOut(); navigate('/'); }} className="w-full">
            <Card className="p-4 flex items-center gap-3 hover:border-red-200 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <X className="h-5 w-5 text-red-600" />
              </div>
              <span className="flex-1 text-sm font-medium text-red-600 text-left">Sign Out</span>
            </Card>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ COUPONS ============
export function CouponsPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    supabase.from('coupons').select('*').eq('is_active', true).order('created_at', { ascending: false }).then(({ data }) => { setCoupons(data || []); setLoading(false); });
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Available Coupons</h1>
        {loading ? <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" /></div> :
        coupons.length === 0 ? (
          <EmptyState icon={<Ticket className="h-16 w-16" />} title="No coupons available" message="Check back later for new offers." />
        ) : (
          <div className="space-y-3">
            {coupons.map(c => (
              <Card key={c.id} className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                  <Ticket className="h-6 w-6 text-rose-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{c.code}</span>
                    <button onClick={() => { navigator.clipboard?.writeText(c.code); }} className="p-1 text-slate-400 hover:text-rose-600"><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {c.discount_type === 'percentage' ? `${c.discount_value}% off` : formatINR(c.discount_value)} off · Min order {formatINR(c.min_order_value)}
                    {c.ends_at && ` · Valid till ${formatDate(c.ends_at)}`}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ REFERRALS ============
export function ReferralsPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    supabase.from('referrals').select('*').eq('referrer_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setReferrals(data || []));
  }, [user, navigate]);

  if (!user) return null;

  const refLink = `${window.location.origin}/signup?ref=${user.referral_code}`;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Refer & Earn</h1>
        <Card className="p-6 mb-4 bg-gradient-to-br from-rose-50 to-amber-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Invite Friends, Earn Rewards</h2>
              <p className="text-sm text-slate-600">Get ₹50 for every friend who joins and makes their first purchase.</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-400 mb-1">Your Referral Code</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900 tracking-wider">{user.referral_code}</span>
              <button onClick={() => { navigator.clipboard?.writeText(user.referral_code || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-3 mb-1">Share this link</p>
            <div className="flex items-center gap-2">
              <input readOnly value={refLink} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600" />
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(refLink)}>Copy</Button>
            </div>
          </div>
        </Card>

        <h3 className="text-sm font-semibold text-slate-800 mb-3">Referral History ({referrals.length})</h3>
        {referrals.length === 0 ? (
          <EmptyState icon={<Users className="h-12 w-12" />} title="No referrals yet" message="Share your code to start earning rewards." />
        ) : (
          <div className="space-y-2">
            {referrals.map(r => (
              <Card key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">Referral</p>
                  <p className="text-xs text-slate-400">{formatDate(r.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-600">+{formatINR(r.reward_amount)}</span>
                  <Badge variant={r.status === 'completed' ? 'success' : 'warning'}>{r.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ SUPPORT ============
export function SupportPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const { push } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: '', category: 'General', message: '' });

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setTickets(data || []));
  }, [user, navigate]);

  const submit = async () => {
    if (!user) return;
    const { data } = await supabase.from('support_tickets').insert({ ...form, user_id: user.id }).select().single();
    if (data) {
      setTickets(prev => [data, ...prev]);
      setShowForm(false);
      setForm({ subject: '', category: 'General', message: '' });
      push('success', 'Ticket created. We\'ll get back to you soon.');
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-900">Help & Support</h1>
          {!showForm && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New Ticket</Button>}
        </div>
        {showForm && (
          <Card className="p-5 mb-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Create Support Ticket</h3>
            <div className="space-y-3">
              <input placeholder="Subject" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option>General</option><option>Order Issue</option><option>Payment Issue</option><option>Product Issue</option><option>Account Issue</option>
              </select>
              <textarea placeholder="Describe your issue..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-y" />
              <div className="flex gap-2">
                <Button size="sm" onClick={submit}>Submit Ticket</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        )}
        {tickets.length === 0 && !showForm ? (
          <EmptyState icon={<HelpCircle className="h-16 w-16" />} title="No support tickets" message="Need help? Create a ticket and our team will assist you." action={<Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Create Ticket</Button>} />
        ) : (
          <div className="space-y-3">
            {tickets.map(t => (
              <Card key={t.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-800">{t.subject}</p>
                  <Badge variant={t.status === 'open' ? 'warning' : t.status === 'answered' ? 'info' : 'success'}>{t.status}</Badge>
                </div>
                <p className="text-sm text-slate-500">{t.message}</p>
                <p className="text-xs text-slate-400 mt-2">{formatDate(t.created_at)} · {t.category}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
