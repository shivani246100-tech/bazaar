import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRouter, Link } from '@/lib/router';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card, Badge } from '@/components/ui/Common';
import { Store, Check, ArrowRight, ArrowLeft, Upload, Shield, TrendingUp, Users, DollarSign, Package } from 'lucide-react';
import { slugify, formatINR } from '@/lib/utils';

export function BecomeSellerPage() {
  const { user, refreshProfile } = useAuth();
  const { navigate } = useRouter();
  const { push } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    store_name: '',
    store_slug: '',
    description: '',
    business_name: '',
    gstin: '',
    pan: '',
    payout_method: 'upi',
    upi_id: '',
    bank_name: '',
    account_number: '',
    ifsc: '',
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="p-8 max-w-md text-center">
          <Store className="h-16 w-16 text-rose-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Sign in to become a seller</h2>
          <p className="text-sm text-slate-500 mb-4">You need an account to start selling on Bazaar.</p>
          <div className="flex gap-2 justify-center">
            <Link to="/login"><Button>Sign In</Button></Link>
            <Link to="/signup"><Button variant="outline">Sign Up</Button></Link>
          </div>
        </Card>
      </div>
    );
  }

  if (user.role === 'seller') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="p-8 max-w-md text-center">
          <Check className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800 mb-2">You're already a seller!</h2>
          <Link to="/seller"><Button>Go to Seller Dashboard</Button></Link>
        </Card>
      </div>
    );
  }

  const steps = [
    { num: 1, title: 'Store Information', desc: 'Tell us about your store' },
    { num: 2, title: 'Business Details', desc: 'Business and KYC information' },
    { num: 3, title: 'Payout Details', desc: 'How you want to receive payments' },
  ];

  const submit = async () => {
    setLoading(true);
    try {
      // Update profile role
      await supabase.from('profiles').update({ role: 'seller' }).eq('id', user.id);

      // Create seller profile
      const { error } = await supabase.from('seller_profiles').insert({
        user_id: user.id,
        store_name: form.store_name,
        store_slug: form.store_slug || slugify(form.store_name),
        description: form.description,
        business_name: form.business_name,
        gstin: form.gstin,
        pan: form.pan,
        kyc_status: 'pending',
        seller_status: 'pending',
      });

      if (error) throw error;

      // Create wallet
      const { data: seller } = await supabase.from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle();
      if (seller) {
        await supabase.from('wallets').insert({ seller_id: seller.id });
        // Assign free plan
        const { data: plan } = await supabase.from('subscription_plans').select('id').eq('slug', 'free').maybeSingle();
        if (plan) {
          await supabase.from('subscriptions').insert({ seller_id: seller.id, plan_id: plan.id, status: 'active', started_at: new Date().toISOString(), renews_at: new Date(Date.now() + 365 * 86400000).toISOString(), amount_paid: 0 });
        }
      }

      await refreshProfile();
      push('success', 'Seller account created! Welcome to Bazaar.');
      navigate('/seller');
    } catch (err: any) {
      push('error', err.message || 'Failed to create seller account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-600 flex items-center justify-center mx-auto mb-4">
            <Store className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Start Selling on Bazaar</h1>
          <p className="text-slate-300 max-w-xl mx-auto">Join thousands of sellers growing their business. Reach millions of customers across India.</p>
        </div>
      </div>

      {/* Benefits */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users, label: '5M+ Customers', desc: 'Reach nationwide' },
            { icon: DollarSign, label: 'Low Commission', desc: 'Starting at 8%' },
            { icon: TrendingUp, label: 'Grow Fast', desc: 'Marketing tools' },
            { icon: Shield, label: 'Secure Payments', desc: 'Guaranteed payouts' },
          ].map((b, i) => (
            <Card key={i} className="p-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center mx-auto mb-2">
                <b.icon className="h-5 w-5 text-rose-600" />
              </div>
              <p className="text-sm font-semibold text-slate-800">{b.label}</p>
              <p className="text-xs text-slate-500">{b.desc}</p>
            </Card>
          ))}
        </div>

        {/* Steps */}
        <Card className="p-6">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-8">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= s.num ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {step > s.num ? <Check className="h-5 w-5" /> : s.num}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 hidden sm:block text-center">{s.title}</div>
                </div>
                {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${step > s.num ? 'bg-rose-500' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Store Info */}
          {step === 1 && (
            <div className="space-y-4 max-w-lg mx-auto">
              <h2 className="text-lg font-semibold text-slate-900">Store Information</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Store Name *</label>
                <input required value={form.store_name} onChange={e => setForm({ ...form, store_name: e.target.value, store_slug: slugify(e.target.value) })} placeholder="e.g. My Awesome Store" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-rose-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Store URL Slug</label>
                <input value={form.store_slug} onChange={e => setForm({ ...form, store_slug: slugify(e.target.value) })} placeholder="my-awesome-store" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-rose-400 focus:outline-none" />
                <p className="text-xs text-slate-400 mt-1">Your store URL: bazaar.app/store/{form.store_slug || 'your-store'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Store Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Tell customers about your store..." className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-rose-400 focus:outline-none resize-y" />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { if (!form.store_name) { push('error', 'Store name is required'); return; } setStep(2); }} disabled={!form.store_name}>Continue <ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {/* Step 2: Business Details */}
          {step === 2 && (
            <div className="space-y-4 max-w-lg mx-auto">
              <h2 className="text-lg font-semibold text-slate-900">Business & KYC Details</h2>
              <p className="text-sm text-slate-500">This information is required for verification and tax compliance.</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Business Name</label>
                <input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} placeholder="Registered business name" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-rose-400 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">GSTIN</label>
                  <input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="27AABCD1234E1Z5" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-rose-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">PAN Number</label>
                  <input value={form.pan} onChange={e => setForm({ ...form, pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-rose-400 focus:outline-none" />
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
                <Button onClick={() => setStep(3)}>Continue <ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {/* Step 3: Payout */}
          {step === 3 && (
            <div className="space-y-4 max-w-lg mx-auto">
              <h2 className="text-lg font-semibold text-slate-900">Payout Details</h2>
              <p className="text-sm text-slate-500">Choose how you want to receive your earnings.</p>
              <div className="space-y-2">
                {[
                  { id: 'upi', label: 'UPI', desc: 'Fastest payout method' },
                  { id: 'bank', label: 'Bank Transfer', desc: 'Direct to your bank account' },
                ].map(p => (
                  <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${form.payout_method === p.id ? 'border-rose-500 bg-rose-50' : 'border-slate-200'}`}>
                    <input type="radio" checked={form.payout_method === p.id} onChange={() => setForm({ ...form, payout_method: p.id })} className="text-rose-600" />
                    <div><p className="text-sm font-medium text-slate-800">{p.label}</p><p className="text-xs text-slate-500">{p.desc}</p></div>
                  </label>
                ))}
              </div>
              {form.payout_method === 'upi' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">UPI ID</label>
                  <input value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} placeholder="yourname@bank" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-rose-400 focus:outline-none" />
                </div>
              )}
              {form.payout_method === 'bank' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank Name</label>
                    <input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} placeholder="State Bank of India" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-rose-400 focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Account Number</label>
                      <input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} placeholder="1234567890" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-rose-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">IFSC Code</label>
                      <input value={form.ifsc} onChange={e => setForm({ ...form, ifsc: e.target.value.toUpperCase() })} placeholder="SBIN0001234" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-rose-400 focus:outline-none" />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /> Back</Button>
                <Button onClick={submit} loading={loading}>Create Seller Account</Button>
              </div>
            </div>
          )}
        </Card>

        {/* Plans preview */}
        <div className="mt-8">
          <h3 className="text-lg font-bold text-slate-900 text-center mb-4">Seller Plans</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: 'Free', price: 0, features: ['10 products', 'Standard support', '12% commission'], popular: false },
              { name: 'Pro', price: 299, features: ['100 products', 'Priority support', '10% commission', 'Promo tools'], popular: true },
              { name: 'Business', price: 799, features: ['1000 products', 'Premium support', '8% commission', 'Featured listings'], popular: false },
            ].map(p => (
              <Card key={p.name} className={`p-5 ${p.popular ? 'border-rose-300 ring-2 ring-rose-500/20' : ''}`}>
                {p.popular && <div className="text-center mb-2"><Badge variant="rose">Most Popular</Badge></div>}
                <h4 className="text-lg font-bold text-slate-900">{p.name}</h4>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatINR(p.price)}<span className="text-sm font-normal text-slate-400">/mo</span></p>
                <ul className="mt-3 space-y-1.5">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          <p className="text-center mt-4 text-sm text-slate-500"><Link to="/seller/plans" className="text-rose-600 font-medium">View full plan comparison →</Link></p>
        </div>
      </div>
    </div>
  );
}
