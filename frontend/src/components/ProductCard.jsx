"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Star } from "lucide-react"
import { money } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function ProductCard({ p }) {
  const price = p.salePrice ?? p.price

  return (
    <Link href={`/product/${p._id}`}>
      <motion.div
        whileHover={{ y: -5 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="h-full"
      >
        <Card className="h-full overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow bg-card/50 backdrop-blur-sm">
          <div className="relative aspect-[4/3] overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={p.images?.[0] || 'https://picsum.photos/seed/food/600/400'} 
              alt={p.title}
              className="object-cover w-full h-full transition-transform duration-500 hover:scale-105"
            />
            {p.salePrice != null && (
              <Badge variant="destructive" className="absolute top-2 left-2">
                Sale
              </Badge>
            )}
            <div className="absolute top-2 right-2 flex gap-1">
              {p.isVeg ? (
                <Badge variant="outline" className="bg-green-100/80 text-green-700 dark:bg-green-900/80 dark:text-green-300 border-green-200">Veg</Badge>
              ) : (
                <Badge variant="outline" className="bg-red-100/80 text-red-700 dark:bg-red-900/80 dark:text-red-300 border-red-200">Non-veg</Badge>
              )}
            </div>
          </div>
          
          <CardContent className="p-4">
            <h3 className="font-semibold text-lg line-clamp-1 mb-1">{p.title}</h3>
            
            {p.partner?.partnerProfile?.storeName && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                {p.partner.partnerProfile.storeName}
              </p>
            )}
            
            <div className="flex items-center justify-between mt-auto pt-2">
              <div className="flex flex-col">
                <span className="font-bold text-lg">{money(price)}</span>
                {p.salePrice != null && (
                  <span className="text-xs text-muted-foreground line-through">{money(p.price)}</span>
                )}
              </div>
              
              {p.ratingCount > 0 && (
                <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 px-2 py-1 rounded-md text-sm font-medium">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  <span>{p.ratingAvg}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  )
}
