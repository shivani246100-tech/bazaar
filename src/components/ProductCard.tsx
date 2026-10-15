import { Heart, ShoppingCart } from 'lucide-react';
import type { Product } from '@/lib/types';
import { Link } from '@/lib/router';
import { formatINR, discountPct } from '@/lib/utils';
import { Rating } from '@/components/ui/Rating';
import { Badge } from '@/components/ui/Common';

export function ProductCard({ product }: { product: Product }) {
  const img = product.product_images?.[0]?.image_url;
  const disc = discountPct(product.mrp, product.selling_price);
  const outOfStock = product.stock <= 0;

  return (
    <Link to={`/product/${product.slug}`} className="group block">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg hover:border-rose-200 transition-all duration-200">
        <div className="relative aspect-square bg-slate-50 overflow-hidden">
          {img ? (
            <img
              src={img}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <ShoppingCart className="h-12 w-12" />
            </div>
          )}
          {disc > 0 && (
            <div className="absolute top-2 left-2">
              <Badge variant="rose">{disc}% OFF</Badge>
            </div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <span className="text-sm font-semibold text-slate-500 bg-white px-3 py-1 rounded-full">Out of Stock</span>
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="text-xs text-slate-400 mb-0.5">{product.brand || 'Generic'}</p>
          <h3 className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug min-h-[2.5rem]">
            {product.name}
          </h3>
          <div className="mt-1.5 mb-1.5">
            <Rating value={product.rating} size={13} showValue count={product.review_count} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-slate-900">{formatINR(product.selling_price)}</span>
            {disc > 0 && (
              <span className="text-xs text-slate-400 line-through">{formatINR(product.mrp)}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="aspect-square bg-slate-200" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-full" />
        <div className="h-4 bg-slate-200 rounded w-2/3" />
        <div className="h-5 bg-slate-200 rounded w-1/2" />
      </div>
    </div>
  );
}

export function WishlistButton({ active, onClick, className = '' }: { active: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={`p-2 rounded-full bg-white/80 backdrop-blur hover:bg-white transition-colors ${className}`}
    >
      <Heart className={`h-5 w-5 ${active ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
    </button>
  );
}
