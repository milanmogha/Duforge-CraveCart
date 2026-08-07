"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { useCart } from "@/context/CartContext"
import { useI18n } from "@/lib/i18n"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"
import { 
  ShoppingCart, 
  Search, 
  Store, 
  Tag, 
  User, 
  LogOut,
  Moon,
  Sun,
  Menu,
  Languages
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export default function Header() {
  const { user, logout } = useAuth()
  const { count } = useCart()
  const { languages, code, setCode } = useI18n()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [q, setQ] = useState("")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const search = (e) => {
    e.preventDefault()
    if (q.trim()) {
      router.push(`/products?search=${encodeURIComponent(q)}`)
      setIsMobileMenuOpen(false)
    }
  }

  const navLinks = [
    { name: "Stores", href: "/stores", icon: Store },
    { name: "Offers", href: "/offers", icon: Tag },
  ]

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-xl">
            <span className="font-black text-xl tracking-tighter">DG</span>
          </div>
          <span className="font-bold text-xl hidden sm:inline-block">
            Dapi<span className="text-primary">GO</span>
          </span>
        </Link>

        {/* Desktop Search */}
        <form onSubmit={search} className="hidden md:flex flex-1 max-w-md relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search for dishes, groceries, stores…" 
            className="pl-10 rounded-full bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background transition-all"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.name}
            </Link>
          ))}
          
          <Link href="/cart" className="relative group">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ShoppingCart className="h-5 w-5 group-hover:scale-110 transition-transform" />
            </Button>
            {count > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full animate-in zoom-in"
              >
                {count}
              </Badge>
            )}
          </Link>

          {/* Language picker — only worth showing once more than English is active */}
          {languages.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Change language">
                  <Languages className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {languages.map((l) => (
                  <DropdownMenuItem
                    key={l.code}
                    onClick={() => setCode(l.code)}
                    className={l.code === code ? "font-semibold text-primary" : ""}
                  >
                    {l.nativeName || l.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* User Menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="relative h-9 w-9 rounded-full outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                <Avatar className="h-9 w-9 border-2 border-primary/20 hover:border-primary transition-colors">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{user.name}</p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground">
                      {user.email || user.phone}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/orders" className="cursor-pointer flex items-center">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    <span>My Orders</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth" className={buttonVariants({ className: "rounded-full px-6" })}>
              Login
            </Link>
          )}
        </nav>

        {/* Mobile Menu Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <Link href="/cart" className="relative">
            <Button variant="ghost" size="icon">
              <ShoppingCart className="h-5 w-5" />
            </Button>
            {count > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[9px] rounded-full"
              >
                {count}
              </Badge>
            )}
          </Link>
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 w-10 outline-none focus:ring-2 focus:ring-primary">
              <Menu className="h-6 w-6" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col gap-6 pt-6">
                <form onSubmit={search} className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search…" 
                    className="pl-9"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </form>
                
                <nav className="flex flex-col gap-4">
                  {navLinks.map((link) => (
                    <Link 
                      key={link.name} 
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 text-lg font-medium"
                    >
                      <link.icon className="h-5 w-5 text-muted-foreground" />
                      {link.name}
                    </Link>
                  ))}
                  
                  <hr className="my-2" />
                  
                  {user ? (
                    <>
                      <Link 
                        href="/orders" 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 text-lg font-medium"
                      >
                        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                        My Orders
                      </Link>
                      <Link 
                        href="/profile" 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 text-lg font-medium"
                      >
                        <User className="h-5 w-5 text-muted-foreground" />
                        Profile Settings
                      </Link>
                      <button 
                        onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                        className="flex items-center gap-3 text-lg font-medium text-destructive"
                      >
                        <LogOut className="h-5 w-5" />
                        Log out
                      </button>
                    </>
                  ) : (
                    <Link href="/auth" onClick={() => setIsMobileMenuOpen(false)} className={buttonVariants({ className: "w-full" })}>
                      Login to DapiGO
                    </Link>
                  )}
                  
                  <div className="flex items-center justify-between mt-4 p-4 bg-muted/50 rounded-xl">
                    <span className="font-medium">Theme</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                    >
                      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    </Button>
                  </div>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  )
}
