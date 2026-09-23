'use client';

import { useEffect, useRef, useState } from 'react';
import { Brain, Clock, MessageSquare, ChartLine as LineChart, Zap, Layers, MonitorSmartphone, HeartHandshake, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Insights',
    description: 'Get real-time guidance based on conversation analysis, customer signals, and proven closing techniques.',
    size: 'large',
    gradient: 'from-primary to-cyan-500',
    highlight: true,
  },
  {
    icon: MessageSquare,
    title: 'Smart Keyword Recognition',
    description: 'Instantly identify customer intent, objections, and buying signals.',
    size: 'medium',
    gradient: 'from-green-500 to-emerald-500',
    highlight: false,
  },
  {
    icon: Zap,
    title: 'Real-time Prompts',
    description: 'Tactical suggestions at the perfect moment during live conversations.',
    size: 'medium',
    gradient: 'from-amber-500 to-orange-500',
    highlight: false,
  },
  {
    icon: Clock,
    title: 'Practice Mode',
    description: 'Perfect your approach with AI-simulated scenarios before taking on real calls.',
    size: 'large',
    gradient: 'from-violet-500 to-purple-500',
    highlight: true,
  },
  {
    icon: LineChart,
    title: 'Performance Analytics',
    description: 'Track progress, identify patterns, and continuously improve your sales approach.',
    size: 'small',
    gradient: 'from-blue-500 to-indigo-500',
    highlight: false,
  },
  {
    icon: Layers,
    title: 'Custom Templates',
    description: 'Choose from proven frameworks or create your own.',
    size: 'small',
    gradient: 'from-rose-500 to-pink-500',
    highlight: false,
  },
  {
    icon: MonitorSmartphone,
    title: 'Universal Integration',
    description: 'Works with Zoom, Teams, Google Meet, and any video calling platform.',
    size: 'small',
    gradient: 'from-cyan-500 to-teal-500',
    highlight: false,
  },
  {
    icon: HeartHandshake,
    title: 'Authentic Connection',
    description: 'Build genuine rapport while maintaining strategic direction in every conversation.',
    size: 'small',
    gradient: 'from-red-500 to-orange-500',
    highlight: false,
  },
];

const Features = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="features"
      className="section-padding relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />

      <div className="container-wide relative z-10">
        {/* Section Header */}
        <div
          className={cn(
            "text-center mb-16 transition-all duration-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Powered by AI</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            Designed for{' '}
            <span className="gradient-text">Closers Who Care</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Tools that enhance your natural selling abilities rather than replace them.
            Every feature is built to help you connect authentically.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-fr">
          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className={cn(
                  "group relative overflow-hidden rounded-2xl p-6 transition-all duration-500 animate-fade-in-up",
                  feature.size === 'large' && "lg:col-span-2 lg:row-span-2",
                  feature.size === 'medium' && "lg:col-span-1 lg:row-span-2",
                  feature.highlight
                    ? "bg-gradient-to-br from-primary/5 to-cyan-500/5 border-2 border-primary/20"
                    : "bg-card border border-border hover:border-primary/30",
                  isVisible ? "opacity-100" : "opacity-0"
                )}
                style={{ animationDelay: `${(index + 1) * 100}ms` }}
              >
                {/* Gradient overlay on hover */}
                <div
                  className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br",
                    feature.gradient,
                    "mix-blend-soft-light"
                  )}
                />

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col">
                  {/* Icon */}
                  <div
                    className={cn(
                      "inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 transition-all duration-300",
                      "bg-gradient-to-br",
                      feature.gradient,
                      "text-white shadow-lg",
                      "group-hover:scale-110 group-hover:shadow-xl"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  {/* Title */}
                  <h3
                    className={cn(
                      "font-semibold mb-2 transition-colors duration-300",
                      feature.size === 'large' ? "text-xl md:text-2xl" : "text-lg"
                    )}
                  >
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p
                    className={cn(
                      "text-muted-foreground leading-relaxed",
                      feature.size === 'large' ? "text-base" : "text-sm"
                    )}
                  >
                    {feature.description}
                  </p>

                  {/* Learn more link for highlighted cards */}
                  {feature.highlight && (
                    <div className="mt-auto pt-4">
                      <button className="inline-flex items-center gap-1 text-sm font-medium text-primary group/link">
                        Learn more
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-1" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Corner decoration */}
                <div
                  className={cn(
                    "absolute -bottom-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-500",
                    "bg-gradient-to-br",
                    feature.gradient
                  )}
                />
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div
          className={cn(
            "text-center mt-16 transition-all duration-700 delay-500",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <p className="text-muted-foreground mb-4">
            And many more features designed to help you close more deals.
          </p>
          <button className="inline-flex items-center gap-2 text-primary font-medium hover:underline underline-offset-4 transition-all">
            View all features
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default Features;
