"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { api } from "@/lib/api"
import { useCanRenderWebGL } from "@/lib/motion"
import Reveal from "@/components/Reveal"
import { ProductCard } from "@/components/ProductCard"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, ChevronRight, Loader2, AlertCircle } from "lucide-react"

// three.js is ~150KB and touches `window` on import — it must never reach the server
// bundle, and it should only be fetched by clients that will actually render it.
const HeroCanvas = dynamic(() => import("@/components/HeroCanvas"), { ssr: false })

export default function Home() {
  const [data, setData] = useState(null)
  const [slide, setSlide] = useState(0)
  const [err, setErr] = useState("")
  const webgl = useCanRenderWebGL()

  useEffect(() => {
    api("/catalog/home")
      .then(setData)
      .catch((e) => setErr(e.message))
  }, [])

  useEffect(() => {
    if (!data?.sliders?.length) return
    const t = setInterval(() => setSlide((s) => (s + 1) % data.sliders.length), 5000)
    return () => clearInterval(t)
  }, [data])

  if (err) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
        <p className="text-muted-foreground">{err}</p>
      </div>
    )
  }
  
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground font-medium animate-pulse">Loading amazing food...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-16">
      
      {/* Hero Slider.
          The slide floats inside a living frame rather than filling the panel edge to edge —
          the ambient layer has to be *visible* to be worth its bytes, and an opaque
          full-bleed photo on top of it would hide it completely. */}
      {data.sliders?.length > 0 && (
        <section className="relative rounded-3xl overflow-hidden shadow-xl p-2 sm:p-3 md:p-4 group">
          {/* WebGL on hardware that can spare the frames; a static brand gradient otherwise.
              Either way it fills the frame while an image is still loading, so the hero
              never flashes an empty grey box. */}
          {webgl ? (
            <HeroCanvas className="absolute inset-0 z-0" />
          ) : (
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#022e2c] via-[#00b3a6] to-[#0d6d66]" />
          )}

          <div className="relative z-10 rounded-2xl overflow-hidden aspect-[21/9] md:aspect-[21/7] ring-1 ring-white/15 shadow-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={slide}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
                className="absolute inset-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.sliders[slide].image}
                  alt={data.sliders[slide].title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-6 md:p-12">
                  <motion.h2
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-white text-3xl md:text-5xl font-black max-w-2xl tracking-tight"
                  >
                    {data.sliders[slide].title}
                  </motion.h2>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="absolute bottom-6 right-6 flex gap-2">
              {data.sliders.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  className={`h-2 rounded-full transition-all ${i === slide ? 'w-8 bg-primary' : 'w-2 bg-white/50 hover:bg-white/80'}`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      {data.categories?.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Shop by category</h2>
          </div>
          <Reveal
            className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"
            delay={40}
          >
            {data.categories.map((c) => (
              <Link
                key={c._id}
                href={`/products?category=${c._id}`}
                className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer text-center"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden bg-muted shadow-sm group-hover:shadow-md transition-shadow">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image} alt={c.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                </div>
                <span className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">{c.name}</span>
              </Link>
            ))}
          </Reveal>
        </section>
      )}

      {/* Featured Products */}
      {data.featured?.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Featured</h2>
            <Link href="/products" className="text-sm font-medium text-primary hover:underline flex items-center">
              View all <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <Reveal className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {data.featured.map((p) => (
              <ProductCard key={p._id} p={p} />
            ))}
          </Reveal>
        </section>
      )}

      {/* Custom Sections */}
      {(data.sections || []).map((sec, secIdx) =>
        sec.products?.length > 0 && (
          <section key={sec._id}>
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight">{sec.title}</h2>
              {sec.subtitle && <p className="text-muted-foreground mt-1">{sec.subtitle}</p>}
            </div>
            <Reveal className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {sec.products.slice(0, 8).map((p) => (
                <ProductCard key={p._id} p={p} />
              ))}
            </Reveal>
          </section>
        )
      )}

      {/* Popular Stores */}
      {data.partners?.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold tracking-tight mb-6">Popular stores</h2>
          <Reveal className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" delay={80}>
            {data.partners.map((s) => (
              <Link key={s._id} href={`/store/${s._id}`}>
                  <Card className="hover:shadow-md transition-shadow overflow-hidden group">
                    <CardContent className="p-0 flex flex-row items-center">
                      <div className="w-32 h-32 bg-muted relative overflow-hidden shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={s.partnerProfile.logo || 'https://picsum.photos/seed/store/200'} 
                          alt="" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-4 flex-1">
                        <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors line-clamp-1">{s.partnerProfile.storeName}</h3>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                          {(s.partnerProfile.cuisineTags || []).join(' · ')}
                        </p>
                        <div className="flex items-center gap-3">
                          {s.partnerProfile.ratingCount > 0 && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              {s.partnerProfile.ratingAvg}
                            </Badge>
                          )}
                          <Badge variant={s.partnerProfile.isOpen ? "default" : "destructive"}>
                            {s.partnerProfile.isOpen ? 'Open' : 'Closed'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
              </Link>
            ))}
          </Reveal>
        </section>
      )}

    </div>
  )
}
