import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, Review, CartItem } from '@/lib/types';
import { useRouter, Link } from '@/lib/router';
import { useAuth as useAuthCtx } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Rating } from '@/components/ui/Rating';
import { ProductCard } from '@/components/ProductCard';
import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState } from '@/components/ui/Common';
import { formatINR, discountPct, formatDate } from '@/lib/utils';
import { Heart, ShoppingCart, Truck, RotateCcw, Shield, Store, Minus, Plus, ChevronRight, CheckCircle2 } from 'lucide-react';

export function ProductDetailPage({ slug }: { slug: string }) {
  const { navigate } = useRouter();
  const { user } = useAuthCtx();
  const { push } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [inWishlist, setInWishlist] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: prod } = await supabase
        .from('products')
        .select('*, category:categories(*), seller:seller_profiles(*), product_images(*)')
        .eq('slug', slug)
        .eq('status', 'approved')
        .maybeSingle();
      if (!prod) { setLoading(false); return; }
      setProduct(prod as any);

      const [revRes, relRes, wishRes] = await Promise.all([
        supabase.from('reviews').select('*, profiles!reviews_user_id_fkey(full_name)').eq('product_id', prod.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('products').select('*, product_images(*)').eq('status', 'approved').eq('category_id', prod.category_id).neq('id', prod.id).limit(5),
        user ? supabase.from('wishlist').select('id').eq('user_id', user.id).eq('product_id', prod.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setReviews((revRes.data as any) || []);
      setRelated((relRes.data as any) || []);
      setInWishlist(!!wishRes.data);
      setLoading(false);
    })();
  }, [slug, user]);

  const addToCart = async (buyNow = false) => {
    if (!user) { push('info', 'Please sign in to add items to cart'); navigate('/login'); return; }
    if (!product || product.stock <= 0) return;
    setCartLoading(true);
    const { data: existing } = await supabase.from('cart_items').select('id, quantity').eq('user_id', user.id).eq('product_id', product.id).maybeSingle();
    if (existing) {
      await supabase.from('cart_items').update({ quantity: existing.quantity + quantity }).eq('id', existing.id);
    } else {
      await supabase.from('cart_items').insert({ user_id: user.id, product_id: product.id, quantity });
    }
    setCartLoading(false);
    push('success', `${product.name} added to cart`);
    if (buyNow) navigate('/cart');
  };

  const toggleWishlist = async () => {
    if (!user) { push('info', 'Please sign in first'); navigate('/login'); return; }
    if (!product) return;
    if (inWishlist) {
      await supabase.from('wishlist').delete().eq('user_id', user.id).eq('product_id', product.id);
      setInWishlist(false);
      push('info', 'Removed from wishlist');
    } else {
      await supabase.from('wishlist').insert({ user_id: user.id, product_id: product.id });
      setInWishlist(true);
      push('success', 'Added to wishlist');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50">
        <EmptyState icon={<ShoppingCart className="h-16 w-16" />} title="Product not found" message="This product may have been removed or is no longer available." action={<Link to="/"><Button>Back to Home</Button></Link>} />
      </div>
    );
  }

  const disc = discountPct(product.mrp, product.selling_price);
  const images = product.product_images || [];
  const seller = product.seller;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <Link to="/" className="hover:text-rose-600">Home</Link>
          <ChevronRight className="h-3 w-3" />
          {product.category && <Link to={`/category/${product.category.slug}`} className="hover:text-rose-600">{product.category.name}</Link>}
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-700 truncate">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Images */}
          <div className="lg:col-span-5">
            <Card className="overflow-hidden">
              <div className="aspect-square bg-slate-50">
                {images[activeImage] ? (
                  <img src={images[activeImage].image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300"><ShoppingCart className="h-20 w-20" /></div>
                )}
              </div>
              {images.length > 1 && (
                <div className="p-3 flex gap-2 overflow-x-auto">
                  {images.map((img, i) => (
                    <button key={img.id} onClick={() => setActiveImage(i)} className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${i === activeImage ? 'border-rose-500' : 'border-slate-200'}`}>
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Info */}
          <div className="lg:col-span-7">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-400 mb-1">{product.brand || 'Generic'}</p>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{product.name}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <Rating value={product.rating} showValue count={product.review_count} />
                  {disc > 0 && <Badge variant="rose">{disc}% OFF</Badge>}
                </div>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-slate-900">{formatINR(product.selling_price)}</span>
                {disc > 0 && <span className="text-lg text-slate-400 line-through">{formatINR(product.mrp)}</span>}
                {disc > 0 && <span className="text-sm font-medium text-emerald-600">You save {formatINR(product.mrp - product.selling_price)}</span>}
              </div>

              <div className="flex items-center gap-2">
                {product.stock > 0 ? (
                  <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> In Stock ({product.stock} available)</Badge>
                ) : (
                  <Badge variant="error">Out of Stock</Badge>
                )}
              </div>

              {/* Seller */}
              {seller && (
                <Link to={`/store/${seller.store_slug}`} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-rose-200 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
                    <Store className="h-5 w-5 text-rose-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{seller.store_name}</p>
                    <Rating value={seller.rating} size={12} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              )}

              {/* Quantity + Actions */}
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-slate-300 rounded-lg">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2.5 hover:bg-slate-50 transition-colors"><Minus className="h-4 w-4 text-slate-600" /></button>
                  <span className="px-4 text-sm font-semibold text-slate-800">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="p-2.5 hover:bg-slate-50 transition-colors"><Plus className="h-4 w-4 text-slate-600" /></button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => addToCart(false)} loading={cartLoading} size="lg" variant="outline" className="flex-1" disabled={product.stock <= 0}>
                  <ShoppingCart className="h-5 w-5" /> Add to Cart
                </Button>
                <Button onClick={() => addToCart(true)} loading={cartLoading} size="lg" className="flex-1" disabled={product.stock <= 0}>
                  Buy Now
                </Button>
                <Button onClick={toggleWishlist} variant="ghost" size="lg" className="px-4">
                  <Heart className={`h-5 w-5 ${inWishlist ? 'fill-rose-500 text-rose-500' : 'text-slate-600'}`} />
                </Button>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { icon: Truck, label: 'Fast Delivery' },
                  { icon: RotateCcw, label: product.return_policy },
                  { icon: Shield, label: 'Secure Payment' },
                ].map((b, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-slate-200">
                    <b.icon className="h-5 w-5 text-rose-600" />
                    <span className="text-xs text-slate-600 text-center">{b.label}</span>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div className="pt-2">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Description</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>
              </div>

              {/* Specs */}
              <div className="pt-2">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Specifications</h3>
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {[
                    { label: 'Brand', value: product.brand || 'Generic' },
                    { label: 'SKU', value: product.sku || '-' },
                    { label: 'Weight', value: product.weight ? `${product.weight} kg` : '-' },
                    { label: 'Category', value: product.category?.name || '-' },
                    { label: 'Shipping', value: product.shipping_info || 'Standard delivery' },
                    { label: 'Return Policy', value: product.return_policy },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-slate-500">{s.label}</span>
                      <span className="font-medium text-slate-800">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="mt-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Customer Reviews ({product.review_count})</h2>
          {reviews.length === 0 ? (
            <Card className="p-8"><EmptyState icon={<Heart className="h-12 w-12" />} title="No reviews yet" message="Be the first to review this product." /></Card>
          ) : (
            <div className="space-y-3">
              {reviews.map(r => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-sm font-semibold text-rose-700">
                        {r.profiles?.full_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{r.profiles?.full_name || 'Anonymous'}</p>
                        <p className="text-xs text-slate-400">{formatDate(r.created_at)}</p>
                      </div>
                    </div>
                    <Rating value={r.rating} size={14} />
                  </div>
                  {r.title && <p className="text-sm font-semibold text-slate-800 mb-1">{r.title}</p>}
                  {r.body && <p className="text-sm text-slate-600">{r.body}</p>}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Related Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {related.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function StorePage({ slug }: { slug: string }) {
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from('seller_profiles').select('*').eq('store_slug', slug).maybeSingle();
      setStore(s);
      if (s) {
        const { data: prods } = await supabase.from('products').select('*, product_images(*)').eq('seller_id', s.id).eq('status', 'approved').order('created_at', { ascending: false });
        setProducts((prods as any) || []);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" /></div>;
  if (!store) return <EmptyState title="Store not found" />;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 h-32 sm:h-40" />
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 -mt-16 relative">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center">
              <Store className="h-8 w-8 text-rose-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-900">{store.store_name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <Rating value={store.rating} showValue />
                <span className="text-sm text-slate-500">{formatINR(store.total_sales)}+ total sales</span>
              </div>
              <p className="text-sm text-slate-600 mt-2">{store.description}</p>
            </div>
            <Badge variant={store.seller_status === 'active' ? 'success' : 'warning'}>Verified Seller</Badge>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Products ({products.length})</h2>
        {products.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="h-12 w-12" />} title="No products yet" message="This store hasn't listed any products yet." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
