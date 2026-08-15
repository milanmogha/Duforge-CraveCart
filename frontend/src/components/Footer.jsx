"use client"

import Link from "next/link"
import { motion } from "framer-motion"

export default function Footer() {
  return (
    <motion.footer 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="bg-muted/40 border-t mt-auto"
    >
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="bg-primary text-primary-foreground p-1.5 rounded-xl">
                <span className="font-black text-xl tracking-tighter">DG</span>
              </div>
              <span className="font-bold text-2xl">
                Dapi<span className="text-primary">GO</span>
              </span>
            </Link>
            <p className="text-muted-foreground max-w-sm mb-6">
              Food, groceries, and essentials from local stores, delivered to your door fast. Experience premium delivery on a budget.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-lg mb-4">Company</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/page/about" className="text-muted-foreground hover:text-primary transition-colors">
                  About us
                </Link>
              </li>
              <li>
                <Link href="/page/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link href="/page/terms" className="text-muted-foreground hover:text-primary transition-colors">
                  Terms & conditions
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-lg mb-4">Help</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/profile?tab=tickets" className="text-muted-foreground hover:text-primary transition-colors">
                  Support tickets
                </Link>
              </li>
              <li>
                <Link href="/page/faq" className="text-muted-foreground hover:text-primary transition-colors">
                  FAQs
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CraveCart. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Made with ❤️ for zero budget.</span>
          </div>
        </div>
      </div>
    </motion.footer>
  )
}
