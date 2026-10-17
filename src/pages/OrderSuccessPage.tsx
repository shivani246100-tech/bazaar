import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, Link, parseQuery } from '@/lib/router';
import { Button } from '@/components/ui/Button';
import { Card, Spinner } from '@/components/ui/Common';
import { formatINR, formatDate } from '@/lib/utils';
import type { Order } from '@/lib/types';
import { Check, MapPin, CreditCard, Package } from 'lucide-react';

const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Celebration() {
  const [show, setShow] = useState(true);

  const reduce = typeof window !== 'undefined' &&
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const confetti = useMemo(() => Array.from({ length: 70 }).map((_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    dur: 2.8 + Math.random() * 2.2,
    size: 6 + Math.random() * 7,
    color: COLORS[i % COLORS.length],
    round: i % 3 === 0,
  })), []);

  const balloons = useMemo(() => Array.from({ length: 8 }).map((_, i) => ({
    left: 5 + i * 12 + Math.random() * 4,
    delay: Math.random() * 1.0,
    dur: 4 + Math.random() * 2,
    size: 28 + Math.random() * 16,
    emoji: i % 4 === 3 ? '🎉' : '🎈',
  })), []);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), 7500);
    return () => clearTimeout(t);
  }, []);

  if (reduce || !show) return null;

  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 60 }}>
      <style>{`
        @keyframes bzConfetti { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0.9; } }
        @keyframes bzBalloon { 0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; } 50% { transform: translateY(-55vh) translateX(14px); }
          100% { transform: translateY(-115vh) translateX(-10px); opacity: 1; } }
      `}</style>
      {confetti.map((c, i) => (
        <span key={`c${i}`} style={{
          position: 'absolute', top: 0, left: `${c.left}%`,
          width: c.size, height: c.round ? c.size : c.size * 0.45,
          background: c.color, borderRadius: c.round ? '50%' : 2,
          animation: `bzConfetti ${c.dur}s ${c.delay}s linear forwards`,
        }} />
      ))}
      {balloons.map((b, i) => (
        <span key={`b${i}`} style={{
          position: 'absolute', bottom: -60, left: `${b.left}%`, fontSize: b.size,
          animation: `bzBalloon ${b.dur}s ${b.delay}s ease-out forwards`,
        }}>{b.emoji}</span>
      ))}
    </div>
  );
}

export function OrderSuccessPage() {
  const { path, navigate } = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = (parseQuery(path).get('ids') || '').split(',').filter(id => UUID.test(id)).slice(0, 20);
    if (ids.length === 0) { navigate('/orders'); return; }
    // Row Level Security returns only the logged-in customer's own orders
    supabase.from('orders').select('*, order_items(*)').in('id', ids).order('created_at')
      .then(({ data }) => { setOrders((data as any) || []); setLoading(false); });
  }, [path]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Spinner className="h-8 w-8" /></div>;
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="p-8 max-w-md text-center">
          <p className="text-slate-700 mb-4">We could not find this order. You can see all your orders here.</p>
          <Link to="/orders"><Button>My Orders</Button></Link>
        </Card>
      </div>
    );
  }

  const grandTotal = orders.reduce((s, o) => s + Number(o.total), 0);
  const isCod = orders.every(o => o.payment_method === 'cod');
  const allPaid = orders.every(o => o.payment_status === 'paid');
  const addr: any = orders[0].shipping_address || {};

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <Celebration />
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
            <Check className="h-10 w-10 text-white" strokeWidth={3} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Order Confirmed! 🎉</h1>
          <p className="text-slate-600 mt-2">Congratulations! Thank you for shopping with Bazaar.</p>
          <p className="text-sm text-slate-500 mt-1">
            {isCod
              ? `Please keep ${formatINR(grandTotal)} ready — you pay when it is delivered.`
              : allPaid
                ? 'Your payment was received.'
                : 'Your payment is still being confirmed.'}
          </p>
        </div>

        {orders.map(o => (
          <Card key={o.id} className="p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-400">Order number</p>
                <p className="text-sm font-bold text-slate-900">{o.order_number}</p>
              </div>
              <p className="text-xs text-slate-400">{formatDate(o.created_at)}</p>
            </div>
            <div className="space-y-2 mb-3">
              {o.order_items?.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                    {item.product_image
                      ? <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package className="h-5 w-5" /></div>}
                  </div>
                  <p className="flex-1 text-sm text-slate-700 truncate">{item.product_name} × {item.quantity}</p>
                  <p className="text-sm font-medium text-slate-900">{formatINR(item.total_price)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-slate-500"><span>Items</span><span>{formatINR(o.subtotal)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Shipping</span><span>{Number(o.shipping_charge) === 0 ? 'Free' : formatINR(o.shipping_charge)}</span></div>
              {Number(o.discount) > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{formatINR(o.discount)}</span></div>}
              <div className="flex justify-between font-bold text-slate-900 pt-1"><span>Total</span><span>{formatINR(o.total)}</span></div>
            </div>
          </Card>
        ))}

        <Card className="p-5 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex gap-3">
              <MapPin className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-800 mb-0.5">Delivering to</p>
                <p className="text-slate-600">{addr.full_name}</p>
                <p className="text-slate-500">{[addr.line1, addr.line2].filter(Boolean).join(', ')}</p>
                <p className="text-slate-500">{[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</p>
                {addr.phone && <p className="text-slate-500">Phone: {addr.phone}</p>}
              </div>
            </div>
            <div className="flex gap-3">
              <CreditCard className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-800 mb-0.5">Payment</p>
                <p className="text-slate-600">{isCod ? 'Cash on Delivery' : 'Online payment'}</p>
                <p className="text-slate-500">
                  {isCod ? `To pay: ${formatINR(grandTotal)}` : allPaid ? `Paid: ${formatINR(grandTotal)}` : `Total: ${formatINR(grandTotal)}`}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="flex-1" onClick={() => navigate('/orders')}>Track My Orders</Button>
          <Button className="flex-1" variant="outline" onClick={() => navigate('/')}>Continue Shopping</Button>
        </div>
      </div>
    </div>
  );
}
