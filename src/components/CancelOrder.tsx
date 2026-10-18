import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Common';
import type { Order } from '@/lib/types';

const REASONS = [
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Delivery is taking too long',
  'Want to change size, colour or address',
  'Want to change the payment method',
  'Other reason',
];

export function CancelOrderCard({ order, onDone }: { order: Order; onDone: (patch: Partial<Order>) => void }) {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const paidOnline = order.payment_method === 'online' && order.payment_status === 'paid';
  const refundPending = order.status === 'cancelled' && paidOnline;
  const canCancel = ['pending', 'confirmed', 'processing'].includes(order.status);

  if (!canCancel && !refundPending) return null;

  const callRefund = async (text: string) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error('Please sign in again');
    const r = await fetch('/api/pay/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: order.id, reason: text }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Could not cancel the order');
  };

  const submit = async () => {
    if (busy) return;
    const text = details.trim() ? `${reason}: ${details.trim()}` : reason;
    setBusy(true);
    try {
      if (paidOnline) {
        await callRefund(text);
        push('success', 'Order cancelled. Your refund has been started.');
        onDone({ status: 'cancelled', payment_status: 'refunded' } as any);
      } else {
        const { error } = await supabase.rpc('customer_cancel_order', { p_order: order.id, p_reason: text });
        if (error) throw error;
        push('success', 'Order cancelled');
        onDone({ status: 'cancelled' } as any);
      }
      setOpen(false);
    } catch (e: any) {
      push('error', e.message || 'Could not cancel the order');
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await callRefund('Cancelled by customer');
      push('success', 'Your refund has been started.');
      onDone({ payment_status: 'refunded' } as any);
    } catch (e: any) {
      push('error', e.message || 'Refund could not be completed');
    } finally {
      setBusy(false);
    }
  };

  if (refundPending) {
    return (
      <Card className="p-4 mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Your order is cancelled, but the refund has not gone through yet.</p>
        <Button size="sm" loading={busy} onClick={retry}>Retry Refund</Button>
      </Card>
    );
  }

  const note = paidOnline
    ? 'The full amount will be refunded to your original payment method in 5-7 working days.'
    : order.payment_method === 'online'
      ? 'You have not paid yet, so nothing will be charged.'
      : 'You pay on delivery, so nothing has been charged.';

  return (
    <Card className="p-4 mb-4">
      {!open ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">Changed your mind? You can cancel until the seller packs your order.</p>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Cancel Order</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-800">Why do you want to cancel?</p>
          <select value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <textarea
            value={details} onChange={e => setDetails(e.target.value)} rows={2} maxLength={120}
            placeholder="Tell us more (optional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-500">{note}</p>
          <div className="flex gap-2">
            <Button size="sm" loading={busy} onClick={submit}>Confirm cancellation</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Keep my order</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
