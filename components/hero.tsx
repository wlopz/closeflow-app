'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Star, TrendingUp, Users, Zap, MessageSquare, Headphones, CircleCheck as CheckCircle2, ChevronRight } from 'lucide-react';

const stats = [
  { value: '20%', label: 'Higher Close Rate', icon: TrendingUp },
  { value: '5,000+', label: 'Sales Professionals', icon: Users },
  { value: '500k+', label: 'Calls Analyzed', icon: MessageSquare },
  { value: '4.9/5', label: 'User Rating', icon: Star },
];

const features = [
  'Real-time AI coaching',
  'Works with any video platform',
  'Instant conversation insights',
  'Proven sales frameworks',
];

const Hero = () => {
  const [isVisible, setIsVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const cn = (...classes: (string | boolean | undefined)[]) =>
    classes.filter(Boolean).join(' ');

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden hero-gradient"
    >
      {/* Grid pattern background */}
      <div className="absolute inset-0 grid-pattern opacity-30" />

      {/* Floating gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl animate-pulse animation-delay-1000" />
      <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-pulse animation-delay-500" />

      <div className="container-wide relative z-10 pt-24 pb-16">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 transition-all duration-700",
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              Trusted by 5,000+ sales professionals
            </span>
          </div>

          {/* Main headline */}
          <h1
            className={cn(
              "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight transition-all duration-700 delay-100",
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            <span className="block">Where Sales Flow with</span>
            <span className="block mt-2">
              <span className="gradient-text">Soul</span>
              <span className="text-muted-foreground mx-3">&amp;</span>
              <span className="gradient-text">Structure</span>
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className={cn(
              "mt-8 text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed transition-all duration-700 delay-200",
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            Real-time AI guidance that helps you close deals with authenticity.
            Perfect your pitch, handle objections, and build genuine connections
            that drive results.
          </p>

          {/* Feature pills */}
          <div
            className={cn(
              "flex flex-wrap justify-center gap-3 mt-8 transition-all duration-700 delay-300",
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            {features.map((feature, index) => (
              <div
                key={feature}
                className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full text-sm font-medium animate-fade-in-up"
                style={{ animationDelay: `${(index + 4) * 100}ms` }}
              >
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {feature}
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div
            className={cn(
              "flex flex-col sm:flex-row gap-4 justify-center mt-10 transition-all duration-700 delay-400",
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            <Link href="/auth/signup" className="group">
              <Button size="lg" className="btn-pill gradient-bg text-white h-14 px-8 text-base group">
                Start Closing Better
                <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="#how-it-works" className="group">
              <Button
                size="lg"
                variant="outline"
                className="btn-pill h-14 px-8 text-base group hover:bg-muted"
              >
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
                <ChevronRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>

          {/* Trust indicator */}
          <p
            className={cn(
              "mt-6 text-sm text-muted-foreground transition-all duration-700 delay-500",
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
          >
            No credit card required - Cancel anytime - 14-day free trial
          </p>

          {/* Stats grid */}
          <div
            className={cn(
              "grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mt-16 pt-16 border-t border-border/50 transition-all duration-700 delay-700",
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            )}
          >
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="group animate-fade-in-up"
                style={{ animationDelay: `${(index + 8) * 100}ms` }}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3 p-3 rounded-2xl bg-muted/50 group-hover:bg-primary/10 transition-colors duration-300">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-3xl md:text-4xl font-bold gradient-text">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Floating UI Preview */}
        <div
          className={cn(
            "mt-20 relative transition-all duration-1000 delay-700",
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-12"
          )}
        >
          {/* Glow effect behind the preview */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-cyan-500/10 to-primary/20 blur-3xl -z-10" />

          {/* Glass card with border */}
          <div className="relative max-w-4xl mx-auto">
            <div className="glass rounded-3xl overflow-hidden shadow-2xl border border-border/50">
              {/* App preview header */}
              <div className="flex items-center gap-2 px-6 py-4 border-b border-border/50 bg-muted/30">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-sm text-muted-foreground">Live Call Analysis</span>
                </div>
              </div>

              {/* App preview content */}
              <div className="p-8 min-h-[300px] flex items-center justify-center">
                <div className="w-full max-w-2xl space-y-6">
                  {/* Transcript simulation */}
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Headphones className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded-lg w-3/4 animate-shimmer" />
                      <div className="h-4 bg-muted rounded-lg w-1/2 animate-shimmer animation-delay-100" />
                    </div>
                  </div>

                  {/* AI Insight simulation */}
                  <div className="flex gap-4 animate-fade-in-scale animation-delay-500">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <Zap className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="flex-1 glass rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-green-500">BUYING SIGNAL</span>
                        <span className="text-xs text-muted-foreground">- Just now</span>
                      </div>
                      <p className="text-sm">
                        Customer is showing strong purchase intent. Consider transitioning to close by summarizing value delivered.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
