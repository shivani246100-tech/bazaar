import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, Link } from '@/lib/router';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { Store, Mail, Lock, User, Phone, ShoppingBag, Shield, TrendingUp } from 'lucide-react';

// ══════════════════════════════════════════════════════
// LOGIN PAGE
// ══════════════════════════════════════════════════════
export function LoginPage() {
  const { signIn, resetPassword } = useAuth();
  const { navigate } = useRouter();
  const { push } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      push('success', 'Login successful!');
      // Role-based redirect: wait for auth state to update
      // App.tsx ke Routes mein /login pe user check hoga aur redirect karega
      navigate('/login');
    } catch (err: any) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      await resetPassword(resetEmail);
      push('success', 'Password reset link sent to your email!');
      setShowReset(false);
      setResetEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left decorative panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-rose-600 to-rose-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative z-10 flex flex-col justify-center px-14 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <Store className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold">Bazaar</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Everything You Need,<br />All in One Place
          </h1>
          <p className="text-rose-100 mb-10 text-lg">
            Trusted sellers. Great prices. Fast delivery.
          </p>
          <div className="space-y-4">
            {[
              { icon: ShoppingBag, text: 'Millions of products from verified sellers' },
              { icon: TrendingUp,  text: 'Best deals and exclusive discounts' },
              { icon: Shield,      text: 'Secure payments and easy returns' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-rose-50">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center">
              <Store className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900">Bazaar</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome Back</h2>
          <p className="text-sm text-slate-500 mb-6">Sign in to your account to continue</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email Address">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="pl-10" />
              </div>
            </Field>
            <Field label="Password">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" className="pl-10" />
              </div>
            </Field>
            <Button type="submit" loading={loading} size="lg" className="w-full">
              Sign In
            </Button>
          </form>

          <button
            onClick={() => { setShowReset(!showReset); setError(''); }}
            className="mt-3 w-full text-center text-sm text-slate-500 hover:text-rose-600 transition-colors"
          >
            Forgot password?
          </button>

          {showReset && (
            <form onSubmit={handleReset}
              className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <p className="text-xs text-slate-500">
                Enter your email — we'll send a reset link.
              </p>
              <Input type="email" required value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com" />
              <Button type="submit" loading={resetLoading} size="sm" className="w-full">
                Send Reset Link
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-rose-600 hover:text-rose-700">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// SIGNUP PAGE
// ══════════════════════════════════════════════════════
export function SignupPage() {
  const { signUp } = useAuth();
  const { navigate } = useRouter();
  const { push } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'seller'>('customer');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await signUp(email, password, fullName, phone, role, referralCode || undefined);
      push('success', role === 'seller'
        ? 'Account created! Sign in, then complete your seller application for admin review.'
        : 'Account created! Please sign in.');
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center">
            <Store className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900">Bazaar</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Create Account</h2>
          <p className="text-sm text-slate-500 mb-6">
            Join Bazaar and start shopping or selling today
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Role selector */}
          <div className="mb-5">
            <p className="text-sm font-medium text-slate-700 mb-2">I want to</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setRole('customer')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  role === 'customer' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-300'
                }`}>
                <ShoppingBag className={`h-5 w-5 mb-2 ${role === 'customer' ? 'text-rose-600' : 'text-slate-400'}`} />
                <p className="text-sm font-semibold text-slate-800">Buy Products</p>
                <p className="text-xs text-slate-500">Shop from sellers</p>
              </button>
              <button type="button" onClick={() => setRole('seller')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  role === 'seller' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-300'
                }`}>
                <Store className={`h-5 w-5 mb-2 ${role === 'seller' ? 'text-rose-600' : 'text-slate-400'}`} />
                <p className="text-sm font-semibold text-slate-800">Sell Products</p>
                <p className="text-xs text-slate-500">Start your store</p>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Full Name">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Rahul Sharma" className="pl-10" />
              </div>
            </Field>
            <Field label="Email Address">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="pl-10" />
              </div>
            </Field>
            <Field label="Phone Number">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210" className="pl-10" />
              </div>
            </Field>
            <Field label="Password">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" className="pl-10" />
              </div>
            </Field>
            <Field label="Referral Code (optional)">
              <Input value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="Enter referral code" />
            </Field>
            <Button type="submit" loading={loading} size="lg" className="w-full">
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-rose-600 hover:text-rose-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
