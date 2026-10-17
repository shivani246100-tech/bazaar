import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card, Badge } from '@/components/ui/Common';
import type { Order } from '@/lib/types';

const REASONS = [
  'Wrong size / does not fit',
  'Damaged or defective',
  'Wrong item received',
  'Not as described',
  'Quality is not good',
  'Changed my mind',
];

const STATUS_TEXT: Record<string, string> = {
  requested: 'Waiting for the seller',
  approved: 'Approved. Please send the item back to the seller',
  rejected: 'Rejected by the seller',
  received: 'Seller received your item',
};

interface Req {
  id: string;
  type: 'return' | 'exchange';
  reason: string;
  status: string;
  seller_note: string | null;
}

export function ReturnExchangeCard({ order }: { order: Order }) {
  const { push } = useToast();
  const [req, setReq] = useState<Req | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [type, setType] = useState<'return' | 'exchange' | null>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('return_requests')
      .select('id, type, reason, status, seller_note').eq('order_id', order.id).maybeSingle();
    setReq((data as any) || null);
    setLoaded(true);
  };
  useEffect(() => { load(); }, [order.id]);

  if (!['delivered', 'completed'].includes(order.status) || !loaded) return null;

  const deliveredAt = new Date((order as any).delivered_at || order.updated_at).getTime();
  const open = Date.now() - deliveredAt < 7 * 24 * 60 * 60 * 1000;

  const submit = async () => {
    if (!type || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc('request_return', {
      p_order: order.id, p_type: type, p_reason: reason, p_details: details,
    });
    setBusy(false);
    if (error) { push('error', error.message); return; }
    push('success', `${type === 'return' ? 'Return' : 'Exchange'} request sent to the seller`);
    setType(null); setDetails('');
    load();
  };

  if (req) {
    return (
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-1">
          <p className="text-sm font-semibold text-slate-800">{req.type === 'return' ? 'Return' : 'Exchange'} request</p>
          <Badge variant={req.status === 'rejected' ? 'error' : req.status === 'requested' ? 'warning' : 'success'}>{req.status}</Badge>
        </div>
        <p className="text-sm text-slate-600">{STATUS_TEXT[req.status]}</p>
        <p className="text-xs text-slate-400 mt-1">Reason: {req.reason}</p>
        {req.seller_note && <p className="text-xs text-slate-500 mt-1">Seller: {req.seller_note}</p>}
      </Card>
    );
  }

  if (!open) {
    return <Card className="p-4 mb-4 text-sm text-slate-500">The 7-day window for return or exchange has ended.</Card>;
  }

  return (
    <Card className="p-4 mb-4">
      <p className="text-sm font-semibold text-slate-800 mb-1">Problem with your order?</p>
      <p className="text-xs text-slate-500 mb-3">You can return or exchange within 7 days of delivery.</p>
      {!type ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setType('return')}>Return</Button>
          <Button size="sm" variant="outline" onClick={() => setType('exchange')}>Exchange</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">{type === 'return' ? 'Return (get a refund)' : 'Exchange (get a different size or item)'}</p>
          <select value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <textarea
            value={details} onChange={e => setDetails(e.target.value)} rows={3} maxLength={500}
            placeholder={type === 'exchange' ? 'Which size or colour do you want instead?' : 'Tell us more (optional)'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" loading={busy} onClick={submit}>Send request</Button>
            <Button size="sm" variant="ghost" onClick={() => setType(null)}>Back</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
