import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './supabase';
import type { Profile, UserRole } from './types';

interface AuthContextValue {
  user: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, phone: string, role: UserRole, referralCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (error) { console.error('Profile load error:', error.message); return null; }
    return data as Profile | null;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        loadProfile(session.user.id).then((profile) => {
          if (!mounted) return;
          setUser(profile);
          setLoading(false);
        }).catch(() => { if (mounted) setLoading(false); });
      } else {
        setLoading(false);
      }
    }).catch(() => { if (mounted) setLoading(false); });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      if (session?.user) {
        (async () => {
          try {
            const profile = await loadProfile(session.user.id);
            if (mounted) { setUser(profile); setLoading(false); }
          } catch { if (mounted) setLoading(false); }
        })();
      }
    });

    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (
    email: string, password: string, fullName: string,
    phone: string, _role: UserRole, referralCode?: string,
  ) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      // Role is intentionally NOT sent: the database always creates customers.
      // Sellers apply separately and are approved by an admin.
      options: { data: { full_name: fullName, phone, ...(referralCode ? { referral_code: referralCode } : {}) } },
    });
    if (error) throw error;
  };

  const signOut = async () => { await supabase.auth.signOut(); setUser(null); };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw error;
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) { const p = await loadProfile(session.user.id); setUser(p); }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshProfile, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
