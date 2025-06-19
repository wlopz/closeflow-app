import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { HeadphonesIcon, MessageSquare, TrendingUp, Users } from 'lucide-react';

const Hero = () => {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background z-0" />
      
      <div className="container relative z-10">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-sm font-medium mb-6">
            <span className="text-primary">New</span>
            <span className="hidden md:inline">Real-time sales guidance powered by AI</span>
            <span className="inline md:hidden">AI-powered sales tool</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Where Sales Flow with <span className="text-primary">Soul</span> and <span className="text-primary">Structure</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
            Real-time AI guidance that helps you close deals with authenticity. Perfect your pitch, handle objections, and build genuine connections.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                <HeadphonesIcon className="w-4 h-4" />
                Start closing better
              </Button>
            </Link>
            <Link href="/demo">
              <Button variant="outline" size="lg">
                Book a demo
              </Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-primary/10 p-3 mb-3">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-medium">20% Higher Close Rates</h3>
            </div>
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-primary/10 p-3 mb-3">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-medium">Real-time Guidance</h3>
            </div>
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-primary/10 p-3 mb-3">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-medium">5000+ Sales Pros</h3>
            </div>
            <div className="flex flex-col items-center">
              <div className="rounded-full bg-primary/10 p-3 mb-3">
                <HeadphonesIcon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-medium">Works with Any Platform</h3>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;