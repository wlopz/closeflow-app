"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Headset, Menu, X, Zap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';

const navigation = [
  { name: 'Features', href: '#features' },
  { name: 'How It Works', href: '#how-it-works' },
  { name: 'Testimonials', href: '#testimonials' },
  { name: 'Pricing', href: '#pricing' },
];

const MainNav = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        scrolled
          ? "glass shadow-lg py-3"
          : "bg-transparent py-5"
      )}
    >
      <nav className="container-wide flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 group"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-cyan-500 rounded-xl blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative bg-gradient-to-r from-primary to-cyan-500 p-2 rounded-xl">
              <Headset className="h-5 w-5 text-white" />
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight group-hover:text-primary transition-colors duration-300">
            CloseFlow
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "animated-underline text-sm font-medium transition-colors duration-200",
                pathname === item.href ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Desktop CTA Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <ModeToggle />
          <Link href="/auth/login">
            <Button variant="ghost" className="btn-pill text-sm">
              Sign in
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button className="btn-pill gradient-bg text-sm group">
              Get Started Free
              <ChevronRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center gap-3">
          <ModeToggle />
          <button
            type="button"
            className="p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors duration-200"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Toggle menu</span>
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={cn(
          "fixed inset-x-0 top-[72px] transition-all duration-500 md:hidden overflow-hidden",
          mobileMenuOpen
            ? "max-h-screen opacity-100"
            : "max-h-0 opacity-0 pointer-events-none"
        )}
      >
        <div className="glass mx-4 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-4 py-6 space-y-4">
            {/* Mobile Navigation Links */}
            <div className="space-y-1">
              {navigation.map((item, index) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "block px-4 py-3 rounded-xl text-base font-medium transition-all duration-300 animate-fade-in-up",
                    pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* Mobile CTA Buttons */}
            <div className="space-y-3">
              <Link href="/auth/login" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full btn-pill text-sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/auth/signup" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full btn-pill gradient-bg text-sm">
                  <Zap className="mr-2 h-4 w-4" />
                  Get Started Free
                </Button>
              </Link>
            </div>

            {/* Trust Indicators for Mobile */}
            <div className="flex items-center justify-center gap-4 pt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>5000+ users</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span>20% higher close rate</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default MainNav;
