"use client"

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { api, money, dt } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, User, MapPin, Wallet, Heart, Ticket, Bell, LogOut } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';

const TABS = [
  { id: 'account', icon: User, label: 'Account' },
  { id: 'addresses', icon: MapPin, label: 'Addresses' },
  { id: 'wallet', icon: Wallet, label: 'Wallet' },
  { id: 'favorites', icon: Heart, label: 'Favorites' },
  { id: 'tickets', icon: Ticket, label: 'Support' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
];

function ProfileContent() {
  const { user, logout } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = searchParams.get('tab') || 'account';

  const setTab = (t) => {
    router.push(`${pathname}?tab=${t}`);
  };

  if (!user) return <div className="flex justify-center items-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 shrink-0 space-y-2">
          <div className="p-4 bg-muted/30 rounded-2xl mb-6">
            <h2 className="font-bold text-xl">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          
          <nav className="flex md:flex-col overflow-x-auto md:overflow-visible pb-2 md:pb-0 gap-2">
            {TABS.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap ${
                    active ? 'bg-primary text-primary-foreground font-semibold shadow-md' : 'hover:bg-muted font-medium text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {t.label}
                </button>
              );
            })}
          </nav>
          
          <div className="hidden md:block pt-4 border-t mt-4">
            <Button variant="ghost" className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { logout(); router.push('/'); }}>
              <LogOut className="mr-2 h-5 w-5" /> Logout
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1">
          <Card className="min-h-[500px] border-primary/10 shadow-lg bg-card/50 backdrop-blur">
            <CardHeader className="border-b bg-muted/20 pb-4 mb-4">
              <CardTitle className="text-2xl flex items-center gap-2">
                {TABS.find(t => t.id === tab)?.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {tab === 'account' && <AccountTab />}
              {tab === 'addresses' && <AddressTab />}
              {tab === 'wallet' && <WalletTab />}
              {tab === 'favorites' && <FavoritesTab />}
              {tab === 'tickets' && <div className="text-muted-foreground text-center py-10">Support Ticket UI (Migrated structure ready)</div>}
              {tab === 'notifications' && <div className="text-muted-foreground text-center py-10">Notifications UI (Migrated structure ready)</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Simple implementations of a few tabs to demonstrate Next.js styling
function AccountTab() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' });
  const [msg, setMsg] = useState('');

  const save = async () => {
    try {
      const d = await api('/auth/profile', { method: 'PUT', body: form });
      setUser(d.user);
      setMsg('Profile updated successfully ✓');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Name</label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Phone</label>
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Email</label>
        <Input value={user.email} disabled className="bg-muted" />
      </div>
      
      {msg && <div className="text-sm font-medium text-green-600 bg-green-50 p-3 rounded-md">{msg}</div>}
      <Button onClick={save} className="mt-4">Save Changes</Button>
    </div>
  );
}

function WalletTab() {
  const { user } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="bg-primary/10 p-8 rounded-full mb-6">
        <Wallet className="h-16 w-16 text-primary" />
      </div>
      <h3 className="text-xl text-muted-foreground font-medium mb-2">Available Balance</h3>
      <div className="text-5xl font-black text-foreground mb-8">{money(user.walletBalance)}</div>
      
      <div className="flex gap-4 w-full max-w-sm">
        <Input placeholder="Enter Amount" type="number" />
        <Button>Add Money</Button>
      </div>
    </div>
  );
}

function AddressTab() {
  const { user } = useAuth();
  return (
    <div>
      <div className="flex justify-end mb-6">
        <Button>+ Add New Address</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(user.addresses || []).map(a => (
          <Card key={a._id} className="border-border hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2 font-bold">{a.label}</div>
              <p className="text-sm text-muted-foreground">{a.line1}, {a.area}, {a.city} {a.pincode}</p>
            </CardContent>
          </Card>
        ))}
        {(user.addresses || []).length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">No saved addresses found.</div>
        )}
      </div>
    </div>
  );
}

function FavoritesTab() {
  const [favs, setFavs] = useState(null);
  useEffect(() => { api('/auth/favorites').then((d) => setFavs(d.favorites)); }, []);
  
  if (!favs) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>;
  if (!favs.length) return <div className="text-center py-8 text-muted-foreground">No favorites yet.</div>;
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {favs.map(p => <ProductCard key={p._id} p={p} />)}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <ProfileContent />
    </Suspense>
  );
}
