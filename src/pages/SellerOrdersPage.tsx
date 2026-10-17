import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card, Badge, EmptyState, Spinner } from '@/components/ui/Common';
import type { Order, SellerProfile } from '@/lib/types';
import { formatINR, formatDate, ORDER_STATUS_LABELS } from '@/lib/utils';
import { ShoppingBag, MapPin } from 'lucide-react';

const NEXT: Record<string, { status: string; label: string }[]> = {
  confirmed: [{ status: 'processing', label: 'Start Processing' }],
  processing: [{ status: 'packed', label: 'Mark Packed' }],
  packed: [{ status: 'shipped', label: 'Ship Order' }],
  shipped: [{ status: 'out_for_delivery', label: 'Out for Delivery' }, { status: 'delivered', label: 'Mark Delivered' }],
  out_for_delivery: [{ status: 'delivered', label: 'Mark Delivered' }],
};
const CAN_CANCEL = ['confirmed', 'processing', 'packed'];

const FILTERS: { id: string; label: string; match: (s: string) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'toship', label: 'To Ship', match: s => ['confirmed', 'processing', 'packed'].includes(s) },
  { id: 'shipped', label: 'Shipped', match: s => ['shipped', 'out_for_delivery'].includes(s) },
  { id: 'delivered', label: 'Delivered', match: s => ['delivered', 'completed'].includes(s) },
  { id: 'cancelled', label: 'Cancelled', match: s => s === 'cancelled' },
];

export function SellerOrdersSecure({ seller }: { seller: SellerProfile }) {
  const { push } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [shipFor, setShipFor] = useState<string | null>(null);
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*), customer:profiles(id, full_name, phone)')
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false });
    setOrders((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [seller.id]);

  const act = async (orderId: string, status: string, extra?: { tracking?: string; courier?: string; reason?: string }) => {
    if (busy) return;
    setBusy(orderId);
    const { error } = await supabase.rpc('seller_update_order', {
      p_order: orderId,
      p_status: status,
      p_tracking: extra?.tracking ?? null,
      p_courier: extra?.courier ?? null,
      p_reason: extra?.reason ?? null,
    });
    setBusy(null);
    if (error) { push('error', error.message); return; }
    push('success', 'Order updated');
    setShipFor(null); setCourier(''); setTracking('');
    load();
  };

  const onAction = (o: Order, status: string) => {
    if (status === 'shipped') { setShipFor(o.id); return; }
    if (status === 'delivered') {
      const cod = o.payment_method === 'cod';
      if (!window.confirm(cod ? 'Mark as delivered? Confirm that the cash payment was collected.' : 'Mark this order as delivered?')) return;
    }
    act(o.id, status);
  };

  const onCancel = (o: Order) => {
    const reason = window.prompt('Reason for cancelling this order (required, min 5 characters). The customer will be notified:');
    if (reason === null) return;
    act(o.id, 'cancelled', { reason });
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  const shown = orders.filter(o => FILTERS.find(f => f.id === filter)!.match(o.status));

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Orders ({orders.length})</h1>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === f.id ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{f.label}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-16 w-16" />} title="No orders here" message="When customers buy your products, orders will appear here." />
      ) : (
        <div className="space-y-3">
          {shown.map(o => {
            const addr: any = o.shipping_address || {};
            const actions = NEXT[o.status] || [];
            return (
              <Card key={o.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{o.order_number}</p>
                    <p className="text-xs text-slate-400">{formatDate(o.created_at)} · {(o as any).customer?.full_name || 'Customer'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{formatINR(o.total)}</span>
                    <Badge variant={o.payment_status === 'paid' ? 'success' : 'warning'}>
                      {o.payment_method === 'cod' && o.payment_status !== 'paid' ? 'COD · collect cash' : o.payment_status}
                    </Badge>
                    <Badge variant="info">{ORDER_STATUS_LABELS[o.status] || o.status}</Badge>
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

                <div className="flex gap-2 text-xs text-slate-500 mb-3">
                  <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
                  <span>
                    {addr.full_name}, {[addr.line1, addr.line2].filter(Boolean).join(', ')}, {addr.city}, {addr.state} - {addr.pincode}
                    {addr.phone ? ` · Phone: ${addr.phone}` : ''}
                  </span>
                </div>

                {o.status === 'pending' && (
                  <p className="text-xs text-amber-600">Waiting for the customer's online payment. You can ship once it is confirmed.</p>
                )}
                {(o as any).tracking_number && (
                  <p className="text-xs text-slate-500 mb-2">Courier: {(o as any).courier} · Tracking: {(o as any).tracking_number}</p>
                )}
                {o.status === 'cancelled' && (o as any).cancel_reason && (
                  <p className="text-xs text-red-600">Cancelled: {(o as any).cancel_reason}</p>
                )}

                {shipFor === o.id && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                    <input value={courier} onChange={e => setCourier(e.target.value)} placeholder="Courier name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking number" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <Button size="sm" loading={busy === o.id} onClick={() => act(o.id, 'shipped', { courier, tracking })}>Confirm Shipment</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShipFor(null)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {(actions.length > 0 || CAN_CANCEL.includes(o.status)) && shipFor !== o.id && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    {actions.map(a => (
                      <Button key={a.status} size="sm" loading={busy === o.id} disabled={!!busy} onClick={() => onAction(o, a.status)}>{a.label}</Button>
                    ))}
                    {CAN_CANCEL.includes(o.status) && o.payment_status !== 'paid' && (
                      <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => onCancel(o)}>Cancel Order</Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
