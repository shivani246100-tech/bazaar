import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, Category, SellerProfile } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { Link } from '@/lib/router';
import { Rating } from '@/components/ui/Rating';
import { formatINR } from '@/lib/utils';
import { Store, ArrowRight, Shield, Truck, RotateCcw, Headphones, TrendingUp, Sparkles, Tag, Users, ShoppingBag, Search } from 'lucide-react';

export function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [deals, setDeals] = useState<Product[]>([]);
  const [topStores, setTopStores] = useState<SellerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [cats, trend, best, fresh, dealP, stores] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('products').select('*, category:categories(*), seller:seller_profiles(*), product_images(*)').eq('status', 'approved').eq('is_trending', true).limit(10),
        supabase.from('products').select('*, category:categories(*), seller:seller_profiles(*), product_images(*)').eq('status', 'approved').order('sales_count', { ascending: false }).limit(10),
        supabase.from('products').select('*, category:categories(*), seller:seller_profiles(*), product_images(*)').eq('status', 'approved').order('created_at', { ascending: false }).limit(10),
        supabase.from('products').select('*, category:categories(*), seller:seller_profiles(*), product_images(*)').eq('status', 'approved').limit(10),
        supabase.from('seller_profiles').select('*').eq('seller_status', 'active').order('rating', { ascending: false }).limit(4),
      ]);
      setCategories(cats.data || []);
      setTrending(trend.data as any || []);
      setBestSellers(best.data as any || []);
      setNewArrivals(fresh.data as any || []);
      setDeals(dealP.data as any || []);
      setTopStores(stores.data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-rose-600 via-rose-700 to-rose-900 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-16 lg:py-20">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Everything You Need,<br />All in One Place
            </h1>
            <p className="mt-4 text-lg text-rose-100 max-w-lg">
              Discover products from trusted sellers at great prices.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/search" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-rose-600 rounded-xl font-semibold hover:bg-rose-50 transition-colors shadow-lg">
                <Search className="h-5 w-5" />
                Start Shopping
              </Link>
              <Link to="/become-seller" className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur text-white border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition-colors">
                <Store className="h-5 w-5" />
                Become a Seller
              </Link>
            </div>
          </div>
        </div>
        {/* Trust badges */}
        <div className="relative border-t border-white/10 bg-rose-900/30 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Shield, label: 'Secure Payments' },
              { icon: Truck, label: 'Fast Delivery' },
              { icon: RotateCcw, label: 'Easy Returns' },
              { icon: Headphones, label: '24/7 Support' },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-white">
                <b.icon className="h-5 w-5 text-rose-200" />
                <span className="text-sm font-medium">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Shop by Category</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {categories.map((c) => (
            <Link key={c.id} to={`/category/${c.slug}`} className="group flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-slate-200 hover:border-rose-300 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                <ShoppingBag className="h-5 w-5 text-rose-600" />
              </div>
              <span className="text-xs font-medium text-slate-700 text-center leading-tight">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending Products */}
      <ProductSection title="Trending Products" icon={<TrendingUp className="h-5 w-5 text-rose-600" />} products={trending} loading={loading} viewAll="/search?sort=trending" />

      {/* Deals Banner */}
      <section className="max-w-7xl mx-auto px-4 py-4">
        <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <Tag className="h-7 w-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Mega Deals Zone</h3>
              <p className="text-amber-50 text-sm">Up to 80% off on selected products</p>
            </div>
          </div>
          <Link to="/search?sort=discount" className="px-5 py-2.5 bg-white text-orange-600 rounded-xl font-semibold hover:bg-amber-50 transition-colors whitespace-nowrap">
            Shop Deals
          </Link>
        </div>
      </section>

      {/* Best Sellers */}
      <ProductSection title="Best Sellers" icon={<Sparkles className="h-5 w-5 text-rose-600" />} products={bestSellers} loading={loading} viewAll="/search?sort=popular" />

      {/* New Arrivals */}
      <ProductSection title="New Arrivals" icon={<ArrowRight className="h-5 w-5 text-rose-600" />} products={newArrivals} loading={loading} viewAll="/search?sort=newest" />

      {/* Top Stores */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Store className="h-5 w-5 text-rose-600" />
            Top Stores
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {topStores.map((s) => (
            <Link key={s.id} to={`/store/${s.store_slug}`} className="group bg-white rounded-xl border border-slate-200 p-5 hover:border-rose-300 hover:shadow-md transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
                  <Store className="h-6 w-6 text-rose-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800 truncate group-hover:text-rose-600 transition-colors">{s.store_name}</h3>
                  <Rating value={s.rating} size={12} />
                </div>
              </div>
              <p className="text-xs text-slate-500 line-clamp-2">{s.description}</p>
              <p className="mt-2 text-xs font-medium text-slate-600">{formatINR(s.total_sales)}+ total sales</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Deals Products */}
      <ProductSection title="Recommended for You" icon={<ShoppingBag className="h-5 w-5 text-rose-600" />} products={deals} loading={loading} viewAll="/search" />

      {/* How It Works */}
      <section className="bg-white border-y border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">How Bazaar Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Search, title: 'Discover', desc: 'Browse products from thousands of trusted sellers across multiple categories.' },
              { icon: ShoppingBag, title: 'Purchase', desc: 'Add to cart, checkout securely with multiple payment options, and place your order.' },
              { icon: Truck, title: 'Receive', desc: 'Track your order in real-time and get it delivered right to your doorstep.' },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-4">
                  <step.icon className="h-7 w-7 text-rose-600" />
                </div>
                <div className="text-sm font-semibold text-rose-600 mb-1">Step {i + 1}</div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seller CTA */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-5 w-5 text-rose-400" />
              <span className="text-sm font-semibold text-rose-400 uppercase tracking-wide">For Sellers</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Start Selling on Bazaar Today</h2>
            <p className="text-slate-300 mb-5">Join thousands of sellers growing their business on Bazaar. Set up your store, list products, and reach millions of customers across India.</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/become-seller" className="inline-flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-colors">
                Become a Seller
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/seller/plans" className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition-colors">
                View Plans
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 shrink-0">
            {[
              { value: '10K+', label: 'Sellers' },
              { value: '1M+', label: 'Products' },
              { value: '5M+', label: 'Customers' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-bold text-rose-400">{stat.value}</div>
                <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {[
            { q: 'How do I track my order?', a: 'Once your order is placed, you can track it in real-time from the "My Orders" section in your profile. You\'ll also receive notifications at each stage.' },
            { q: 'What payment methods are supported?', a: 'We support UPI, Credit/Debit Cards, Net Banking, and other popular payment methods through our secure payment gateway.' },
            { q: 'How does the return policy work?', a: 'Most products come with a 7-day easy return policy. If you\'re not satisfied, you can request a return from your order details page.' },
            { q: 'How can I become a seller?', a: 'Click "Become a Seller" and complete the registration flow. Once your account is verified, you can start listing products immediately.' },
            { q: 'Is my payment information secure?', a: 'Yes, we use a PCI-compliant payment gateway. We never store your card details, CVV, or UPI PIN on our servers.' },
          ].map((faq, i) => (
            <details key={i} className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
              <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                <span className="text-sm font-medium text-slate-800">{faq.q}</span>
                <span className="text-slate-400 group-open:rotate-180 transition-transform">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </summary>
              <div className="px-4 pb-4 text-sm text-slate-600">{faq.a}</div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductSection({ title, icon, products, loading, viewAll }: { title: string; icon: React.ReactNode; products: Product[]; loading: boolean; viewAll: string }) {
  if (loading) {
    return (
      <section className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">{icon}{title}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
              <div className="aspect-square bg-slate-200" />
              <div className="p-3 space-y-2"><div className="h-3 bg-slate-200 rounded w-1/3" /><div className="h-4 bg-slate-200 rounded w-full" /><div className="h-5 bg-slate-200 rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!products.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">{icon}{title}</h2>
        <Link to={viewAll} className="text-sm font-medium text-rose-600 hover:text-rose-700 flex items-center gap-1">
          View All <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {products.slice(0, 10).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}
