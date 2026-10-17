import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRouter } from '@/lib/router';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Common';
import { Select, Input, Textarea, Field } from '@/components/ui/Input';
import type { Category, SellerProfile } from '@/lib/types';
import { slugify } from '@/lib/utils';
import { X, Upload } from 'lucide-react';

const MAX_FILES = 6;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

type Picked = { file: File; preview: string };

export function AddProductUpload({ seller }: { seller: SellerProfile }) {
  const { user } = useAuth();
  const { push } = useToast();
  const { navigate } = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<Picked[]>([]);
  const [form, setForm] = useState({
    name: '', category_id: '', brand: '', description: '', mrp: '', selling_price: '',
    stock: '', sku: '', weight: '', shipping_info: '', return_policy: '7 Days Easy Returns',
  });

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_active', true).order('name')
      .then(({ data }) => setCategories(data || []));
  }, []);

  // free preview memory when leaving the page
  useEffect(() => {
    return () => { files.forEach(f => URL.revokeObjectURL(f.preview)); };
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const next = [...files];
    for (const f of picked) {
      if (!ALLOWED.includes(f.type)) { push('error', `${f.name}: only JPG, PNG or WEBP photos are allowed`); continue; }
      if (f.size > MAX_BYTES) { push('error', `${f.name}: photo is larger than 5 MB`); continue; }
      if (next.length >= MAX_FILES) { push('error', `You can add at most ${MAX_FILES} photos`); break; }
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setFiles(next);
  };

  const removeFile = (i: number) => {
    URL.revokeObjectURL(files[i].preview);
    setFiles(files.filter((_, j) => j !== i));
  };

  const submit = async () => {
    if (loading) return;
    if (!user) { push('error', 'Please sign in again'); return; }
    const price = parseFloat(form.selling_price);
    const mrp = form.mrp ? parseFloat(form.mrp) : price;
    const stock = form.stock ? parseInt(form.stock) : 0;
    if (!form.name.trim() || !form.category_id) { push('error', 'Please fill the product name and category'); return; }
    if (!price || price <= 0) { push('error', 'Enter a valid selling price'); return; }
    if (mrp < price) { push('error', 'MRP cannot be less than the selling price'); return; }
    if (stock < 0) { push('error', 'Stock cannot be negative'); return; }
    if (files.length === 0) { push('error', 'Please add at least one product photo'); return; }

    setLoading(true);
    const uploadedPaths: string[] = [];
    try {
      // 1) upload photos to the seller's own folder
      const urls: string[] = [];
      for (const p of files) {
        const ext = p.file.type === 'image/png' ? 'png' : p.file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('product-images')
          .upload(path, p.file, { contentType: p.file.type, cacheControl: '3600' });
        if (upErr) throw new Error(`Photo upload failed: ${upErr.message}`);
        uploadedPaths.push(path);
        urls.push(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl);
      }

      // 2) create the product (always saved as "pending" by the server)
      const slug = `${slugify(form.name)}-${Date.now().toString(36)}`;
      const { data: product, error } = await supabase.from('products').insert({
        seller_id: seller.id,
        category_id: form.category_id,
        name: form.name.trim(),
        slug,
        brand: form.brand || null,
        description: form.description,
        mrp,
        selling_price: price,
        stock,
        sku: form.sku || null,
        weight: form.weight ? parseFloat(form.weight) : null,
        shipping_info: form.shipping_info || null,
        return_policy: form.return_policy,
        status: 'pending',
      }).select().single();
      if (error) throw error;

      // 3) link the photos to the product
      const { error: imgErr } = await supabase.from('product_images').insert(
        urls.map((url, i) => ({ product_id: product.id, image_url: url, sort_order: i }))
      );
      if (imgErr) throw imgErr;

      push('success', 'Product submitted for approval!');
      navigate('/seller/products');
    } catch (err: any) {
      if (uploadedPaths.length) await supabase.storage.from('product-images').remove(uploadedPaths);
      push('error', err.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-4">Add New Product</h1>
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Product Name *"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cotton T-Shirt" /></Field>
          <Field label="Brand"><Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="e.g. Trendz" /></Field>
        </div>
        <Field label="Category *">
          <Select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Select category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Description"><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe your product..." /></Field>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="MRP (₹)"><Input type="number" value={form.mrp} onChange={e => setForm({ ...form, mrp: e.target.value })} placeholder="999" /></Field>
          <Field label="Selling Price (₹) *"><Input type="number" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} placeholder="499" /></Field>
          <Field label="Stock Quantity"><Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="100" /></Field>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="SKU"><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="TRZ-001" /></Field>
          <Field label="Weight (kg)"><Input type="number" step="0.01" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} placeholder="0.2" /></Field>
          <Field label="Return Policy"><Input value={form.return_policy} onChange={e => setForm({ ...form, return_policy: e.target.value })} /></Field>
        </div>
        <Field label="Shipping Information"><Input value={form.shipping_info} onChange={e => setForm({ ...form, shipping_info: e.target.value })} placeholder="Ships in 2-3 days" /></Field>

        {/* Photos */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Product Photos * (up to {MAX_FILES}, JPG/PNG/WEBP, max 5 MB each)</label>
          <div className="flex flex-wrap gap-3">
            {files.map((p, i) => (
              <div key={p.preview} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                <img src={p.preview} alt="" className="w-full h-full object-cover" />
                {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">Main</span>}
                <button type="button" onClick={() => removeFile(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center text-slate-700 hover:text-red-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {files.length < MAX_FILES && (
              <label className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-rose-400 hover:text-rose-500 cursor-pointer transition-colors">
                <Upload className="h-5 w-5 mb-1" />
                <span className="text-xs">Add photo</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onPick} />
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={submit} loading={loading}>Submit for Approval</Button>
          <Button variant="ghost" onClick={() => navigate('/seller/products')}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}
