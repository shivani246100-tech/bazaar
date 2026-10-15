import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, Category } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { useRouter, parseQuery, Link } from '@/lib/router';
import { Select } from '@/components/ui/Input';
import { EmptyState, Card } from '@/components/ui/Common';
import { SlidersHorizontal, X, Search as SearchIcon, ChevronDown } from 'lucide-react';

export function SearchPage() {
  const { path } = useRouter();
  const query = parseQuery(path);
  const q = query.get('q') || '';
  const cat = query.get('category') || '';
  const sort = query.get('sort') || 'relevance';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 20000]);
  const [minRating, setMinRating] = useState(0);
  const [inStock, setInStock] = useState(false);
  const [selectedCats, setSelectedCats] = useState<string[]>(cat ? [cat] : []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let dbQuery = supabase.from('products').select('*, category:categories(*), seller:seller_profiles(*), product_images(*)').eq('status', 'approved');

    if (q) {
      dbQuery = dbQuery.or(`name.ilike.%${q}%,brand.ilike.%${q}%,description.ilike.%${q}%`);
    }
    if (selectedCats.length > 0) {
      const catIds = categories.filter(c => selectedCats.includes(c.slug)).map(c => c.id);
      if (catIds.length > 0) dbQuery = dbQuery.in('category_id', catIds);
    }
    if (sort === 'price_low') dbQuery = dbQuery.order('selling_price', { ascending: true });
    else if (sort === 'price_high') dbQuery = dbQuery.order('selling_price', { ascending: false });
    else if (sort === 'rating') dbQuery = dbQuery.order('rating', { ascending: false });
    else if (sort === 'newest') dbQuery = dbQuery.order('created_at', { ascending: false });
    else if (sort === 'popular') dbQuery = dbQuery.order('sales_count', { ascending: false });
    else if (sort === 'trending') dbQuery = dbQuery.eq('is_trending', true).order('sales_count', { ascending: false });
    else if (sort === 'discount') dbQuery = dbQuery.order('mrp', { ascending: false });
    else dbQuery = dbQuery.order('sales_count', { ascending: false });

    const { data, error } = await dbQuery.limit(60);
    if (error) { console.error(error); }
    let filtered = (data as any) || [];
    if (inStock) filtered = filtered.filter((p: Product) => p.stock > 0);
    filtered = filtered.filter((p: Product) => p.selling_price >= priceRange[0] && p.selling_price <= priceRange[1]);
    if (minRating > 0) filtered = filtered.filter((p: Product) => p.rating >= minRating);
    setProducts(filtered);
    setLoading(false);
  }, [q, sort, selectedCats, categories, inStock, priceRange, minRating]);

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order').then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const toggleCat = (slug: string) => {
    setSelectedCats(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);
  };

  const FilterPanel = () => (
    <div className="space-y-5">
      <div>
        <h4 className="text-sm font-semibold text-slate-800 mb-2">Price Range</h4>
        <div className="flex items-center gap-2">
          <input type="number" value={priceRange[0]} onChange={(e) => setPriceRange([+e.target.value, priceRange[1]])} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Min" />
          <span className="text-slate-400">-</span>
          <input type="number" value={priceRange[1]} onChange={(e) => setPriceRange([priceRange[0], +e.target.value])} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Max" />
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-slate-800 mb-2">Minimum Rating</h4>
        <div className="space-y-1.5">
          {[4, 3, 2, 1].map(r => (
            <button key={r} onClick={() => setMinRating(minRating === r ? 0 : r)} className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-sm transition-colors ${minRating === r ? 'bg-rose-50 text-rose-700' : 'hover:bg-slate-50 text-slate-600'}`}>
              <span className="text-amber-500">{'★'.repeat(r)}</span>
              <span>{r}+ stars</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-slate-800 mb-2">Availability</h4>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
          <span className="text-sm text-slate-600">In Stock Only</span>
        </label>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-slate-800 mb-2">Categories</h4>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {categories.map(c => (
            <label key={c.id} className="flex items-center gap-2 cursor-pointer py-1">
              <input type="checkbox" checked={selectedCats.includes(c.slug)} onChange={() => toggleCat(c.slug)} className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
              <span className="text-sm text-slate-600">{c.name}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {q ? `Results for "${q}"` : cat ? categories.find(c => c.slug === cat)?.name || 'Products' : 'All Products'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{loading ? 'Searching...' : `${products.length} products found`}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(true)} className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
            <Select value={sort} onChange={(e) => { const params = new URLSearchParams(query); params.set('sort', e.target.value); window.history.pushState({}, '', `/search?${params}`); window.dispatchEvent(new PopStateEvent('popstate')); }} className="w-auto">
              <option value="relevance">Relevance</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="rating">Rating</option>
              <option value="newest">Newest First</option>
              <option value="popular">Best Selling</option>
            </Select>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Desktop filters */}
          <aside className="hidden lg:block w-64 shrink-0">
            <Card className="p-4 sticky top-28">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-800">Filters</h3>
                <button onClick={() => { setPriceRange([0, 20000]); setMinRating(0); setInStock(false); setSelectedCats([]); }} className="text-xs text-rose-600 hover:underline">Clear All</button>
              </div>
              <FilterPanel />
            </Card>
          </aside>

          {/* Products grid */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
                    <div className="aspect-square bg-slate-200" />
                    <div className="p-3 space-y-2"><div className="h-3 bg-slate-200 rounded w-1/3" /><div className="h-4 bg-slate-200 rounded w-full" /><div className="h-5 bg-slate-200 rounded w-1/2" /></div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <EmptyState icon={<SearchIcon className="h-16 w-16" />} title="No products found" message="Try adjusting your filters or search terms." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {products.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowFilters(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl overflow-y-auto animate-in">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="text-base font-semibold text-slate-900">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-5 w-5 text-slate-500" /></button>
            </div>
            <div className="p-4"><FilterPanel /></div>
            <div className="p-4 sticky bottom-0 bg-white border-t border-slate-100">
              <button onClick={() => setShowFilters(false)} className="w-full py-2.5 bg-rose-600 text-white rounded-lg font-medium text-sm">Show {products.length} Results</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CategoryPage({ slug }: { slug: string }) {
  const { navigate } = useRouter();
  useEffect(() => { navigate(`/search?category=${slug}`); }, [slug, navigate]);
  return null;
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order').then(({ data }) => setCategories(data || []));
  }, []);
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">All Categories</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map(c => (
            <Link key={c.id} to={`/category/${c.slug}`} className="group flex flex-col items-center gap-3 p-6 bg-white rounded-xl border border-slate-200 hover:border-rose-300 hover:shadow-md transition-all">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                <SearchIcon className="h-7 w-7 text-rose-600" />
              </div>
              <span className="text-sm font-medium text-slate-700 text-center">{c.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
