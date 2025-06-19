"use client";

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { Headset } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';

const MainNav = () => {
  const pathname = usePathname();
  
  return (
    <div className="flex gap-6 md:gap-10">
      <Link href="/" className="flex items-center space-x-2">
        <Headset className="h-6 w-6" />
        <span className="inline-block font-bold">CloseFlow</span>
      </Link>
      <nav className="hidden md:flex gap-6">
        <Link 
          href="/features"
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            pathname === "/features" ? "text-primary" : "text-muted-foreground"
          )}
        >
          Features
        </Link>
        <Link 
          href="/pricing"
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            pathname === "/pricing" ? "text-primary" : "text-muted-foreground"
          )}
        >
          Pricing
        </Link>
        <Link 
          href="/blog"
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            pathname === "/blog" ? "text-primary" : "text-muted-foreground"
          )}
        >
          Blog
        </Link>
        <Link 
          href="/contact"
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            pathname === "/contact" ? "text-primary" : "text-muted-foreground"
          )}
        >
          Contact
        </Link>
      </nav>
      <div className="ml-auto md:hidden">
        <ModeToggle />
      </div>
    </div>
  );
};

export default MainNav;