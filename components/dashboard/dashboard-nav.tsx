"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart, 
  Clock, 
  Headset, 
  Home, 
  LogOut, 
  MessageSquare, 
  Settings, 
  Users 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';

const DashboardNav = () => {
  const pathname = usePathname();

  return (
    <div className="h-screen w-64 border-r hidden md:block">
      <div className="h-full px-3 py-4 flex flex-col justify-between">
        <div>
          <div className="px-3 py-2">
            <Link href="/" className="flex items-center space-x-2">
              <Headset className="h-6 w-6" />
              <span className="text-xl font-bold">CloseFlow</span>
            </Link>
          </div>
          
          <nav className="space-y-1 mt-8">
            <Link
              href="/dashboard"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary",
                pathname === "/dashboard" 
                  ? "bg-muted text-primary font-medium" 
                  : "text-muted-foreground"
              )}
            >
              <Home className="h-5 w-5" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/calls"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary",
                pathname === "/dashboard/calls" 
                  ? "bg-muted text-primary font-medium" 
                  : "text-muted-foreground"
              )}
            >
              <Headset className="h-5 w-5" />
              Calls
            </Link>
            <Link
              href="/dashboard/analytics"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary",
                pathname === "/dashboard/analytics" 
                  ? "bg-muted text-primary font-medium" 
                  : "text-muted-foreground"
              )}
            >
              <BarChart className="h-5 w-5" />
              Analytics
            </Link>
            <Link
              href="/dashboard/templates"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary",
                pathname === "/dashboard/templates" 
                  ? "bg-muted text-primary font-medium" 
                  : "text-muted-foreground"
              )}
            >
              <MessageSquare className="h-5 w-5" />
              Templates
            </Link>
            <Link
              href="/dashboard/calendar"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary",
                pathname === "/dashboard/calendar" 
                  ? "bg-muted text-primary font-medium" 
                  : "text-muted-foreground"
              )}
            >
              <Clock className="h-5 w-5" />
              Calendar
            </Link>
            <Link
              href="/dashboard/team"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary",
                pathname === "/dashboard/team" 
                  ? "bg-muted text-primary font-medium" 
                  : "text-muted-foreground"
              )}
            >
              <Users className="h-5 w-5" />
              Team
            </Link>
          </nav>
        </div>
        
        <div className="space-y-4">
          <div className="px-3 flex justify-between">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard/settings">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </Link>
            </Button>
            <ModeToggle />
            <Button variant="ghost" size="icon">
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Log out</span>
            </Button>
          </div>
          
          <div className="px-3 py-2 border-t">
            <div className="flex items-center gap-3 py-3">
              <div className="rounded-full bg-primary h-9 w-9 flex items-center justify-center text-primary-foreground font-medium">
                JS
              </div>
              <div>
                <p className="text-sm font-medium">John Smith</p>
                <p className="text-xs text-muted-foreground">Pro Plan</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardNav;