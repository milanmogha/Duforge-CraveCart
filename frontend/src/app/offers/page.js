"use client"

import { useEffect, useState } from 'react';
import { api, money, dt } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Ticket, Copy, CheckCircle2, Clock } from 'lucide-react';

export default function OffersPage() {
  const [promos, setPromos] = useState(null);
  const [copied, setCopied] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { 
    api('/catalog/promos')
      .then((d) => setPromos(d.promos))
      .finally(() => setLoading(false));
  }, []);

  const copy = (code) => {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Offers & Coupons</h1>
        <p className="text-muted-foreground text-lg">Apply these codes at checkout to save on your orders.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : promos?.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center">
          <div className="bg-muted p-6 rounded-full"><Ticket className="h-12 w-12 text-muted-foreground" /></div>
          <h2 className="text-2xl font-bold">No active offers right now</h2>
          <p className="text-muted-foreground">Check back soon for exciting deals and discounts!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {promos?.map((p, i) => (
              <motion.div
                key={p._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="h-full border-primary/20 hover:border-primary/50 transition-colors shadow-sm overflow-hidden flex flex-col">
                  {/* Top section with dashed border effect */}
                  <div className="bg-primary/5 p-6 border-b-2 border-dashed relative flex items-center justify-center min-h-[120px]">
                    {/* Left/Right cutouts for ticket effect */}
                    <div className="absolute -left-3 -bottom-3 w-6 h-6 rounded-full bg-background border-t-2 border-r-2 border-transparent shadow-inner"></div>
                    <div className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full bg-background border-t-2 border-l-2 border-transparent shadow-inner"></div>
                    
                    <div className="text-center">
                      <div className="text-4xl font-black text-primary drop-shadow-sm mb-1">
                        {p.type === 'percent' ? `${p.value}%` : money(p.value)}
                      </div>
                      <div className="text-sm font-bold tracking-widest text-primary/70 uppercase">OFF</div>
                    </div>
                  </div>
                  
                  {/* Bottom section */}
                  <CardContent className="p-6 flex flex-col flex-1">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <h3 className="font-bold text-xl tracking-wide">{p.code}</h3>
                      {p.store && (
                        <span className="bg-secondary text-secondary-foreground text-xs font-semibold px-2 py-1 rounded">
                          {p.store}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-muted-foreground mb-4 line-clamp-2 min-h-[40px]">{p.description}</p>
                    
                    <div className="space-y-1.5 mt-auto pt-4 border-t border-muted">
                      {p.minOrder > 0 && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 mr-2"></span>
                          Min order {money(p.minOrder)}
                        </div>
                      )}
                      {p.maxDiscount && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 mr-2"></span>
                          Up to {money(p.maxDiscount)} discount
                        </div>
                      )}
                      {p.endsAt && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="w-3.5 h-3.5 mr-1.5 opacity-50" />
                          Valid till {dt(p.endsAt)}
                        </div>
                      )}
                    </div>
                    
                    <Button 
                      variant={copied === p.code ? "default" : "outline"}
                      className={`w-full mt-6 ${copied === p.code ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' : 'hover:border-primary/50'}`}
                      onClick={() => copy(p.code)}
                    >
                      {copied === p.code ? (
                        <><CheckCircle2 className="mr-2 h-4 w-4" /> Copied!</>
                      ) : (
                        <><Copy className="mr-2 h-4 w-4" /> Copy Code</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
