"use client"

import { useEffect, useState, use } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileText, HelpCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StaticPage({ params }) {
  const { slug } = use(params);
  const [page, setPage] = useState(null);
  const [faqs, setFaqs] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    setLoading(true);
    setPage(null); setFaqs(null); setErr('');
    if (slug === 'faq') {
      api('/catalog/faqs')
        .then((d) => setFaqs(d.faqs))
        .catch((e) => setErr(e.message))
        .finally(() => setLoading(false));
    } else {
      api(`/catalog/pages/${slug}`)
        .then((d) => setPage(d.page))
        .catch((e) => setErr(e.message))
        .finally(() => setLoading(false));
    }
  }, [slug]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (err) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="bg-destructive/10 p-6 rounded-full"><FileText className="h-12 w-12 text-destructive" /></div>
        <h2 className="text-2xl font-bold">Page not found</h2>
        <p className="text-muted-foreground">{err}</p>
      </div>
    );
  }

  if (slug === 'faq' && faqs) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="text-center mb-10">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Frequently Asked Questions</h1>
          <p className="text-muted-foreground text-lg">Find answers to common questions about our service.</p>
        </div>
        
        <div className="space-y-4">
          {faqs.map((f, i) => (
            <Card key={f._id} className="overflow-hidden border-border/50 shadow-sm hover:border-primary/30 transition-colors">
              <button 
                className="w-full text-left px-6 py-4 flex items-center justify-between focus:outline-none"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="font-semibold text-lg">{f.question}</span>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${openFaq === i ? 'rotate-180 text-primary' : ''}`} />
              </button>
              
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-6 pb-5 pt-0 text-muted-foreground leading-relaxed border-t border-border/30 mt-2">
                      <div className="pt-3">{f.answer}</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!page) return null;

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8 border-b pb-6">
        <h1 className="text-4xl font-bold tracking-tight">{page.title}</h1>
      </div>
      <Card className="shadow-lg border-primary/5">
        <CardContent className="p-8 md:p-12 prose prose-stone dark:prose-invert max-w-none">
          <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed font-medium">
            {page.content}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
