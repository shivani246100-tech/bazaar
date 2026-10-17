import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card, Badge, EmptyState, Spinner } from '@/components/ui/Common';
import type { SellerProfile } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { ArrowDownRight } from 'lucide-react';

export function SellerReturns({ seller }: { seller: SellerProfile }) {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from('return_requests')
      .select('*, order:orders(order_number, shipping_address, order_items(product_name, quantity))')
      .eq('seller_id', seller.id).order('created_at', { ascending: false });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [seller.id]);

  const act = async (id: string, action: 'approve' | 'reject' | 'received') => {
    if (busy) return;
    let note = '';
    if (action === 'reject') {
      const r = window.prompt('Reason for rejecting (required, min 5 characters). The customer will see it:');
      if (r === null) return;
      note = r;
    } else if (action === 'received' && !window.confirm('Confirm that you received the item back?')) return;
    setBusy(id);
    const { error } = await supabase.rpc('seller_handle_return', { p_request: id, p_action: action, p_note: note });
    setBusy(null);
    if (error) { push('error', error.message); return; }
    push('success', 'Updated');
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Returns &amp; Exchanges ({rows.length})</h1>
      {rows.length === 0 ? (
        <EmptyState icon={<ArrowDownRight className="h-16 w-16" />} title="No requests" message="Return and exchange requests from customers will appear here." />
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{r.order?.order_number} · {r.type === 'return' ? 'Return' : 'Exchange'}</p>
                  <p className="text-xs text-slate-400">{formatDate(r.created_at)} · {r.order?.shipping_address?.full_name}</p>
                </div>
                <Badge variant={r.status === 'rejected' ? 'error' : r.status === 'requested' ? 'warning' : 'success'}>{r.status}</Badge>
              </div>
              <p className="text-sm text-slate-600">{r.order?.order_items?.map((i: any) => `${i.product_name} × ${i.quantity}`).join(', ')}</p>
              <p className="text-sm text-slate-700 mt-1">Reason: {r.reason}</p>
              {r.details && <p className="text-sm text-slate-500">“{r.details}”</p>}
              {r.seller_note && <p className="text-xs text-slate-400 mt-1">Your note: {r.seller_note}</p>}
              <div className="flex gap-2 mt-3">
                {r.status === 'requested' && (
                  <>
                    <Button size="sm" loading={busy === r.id} onClick={() => act(r.id, 'approve')}>Approve</Button>
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act(r.id, 'reject')}>Reject</Button>
                  </>
                )}
                {r.status === 'approved' && (
                  <Button size="sm" loading={busy === r.id} onClick={() => act(r.id, 'received')}>Mark item received</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
