'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Zap, CircleCheck as CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const benefits = [
  '14-day free trial',
  'No credit card required',
  'Cancel anytime',
  'Setup in 2 minutes',
];

const CTASection = () => {
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
      className="section-padding relative overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-cyan-500/5 to-primary/5" />

      {/* Decorative elements */}
      <div className="absolute top-1/2 left-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-x-1/2" />
      <div className="absolute top-1/2 right-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl translate-x-1/2" />

      <div className="container-wide relative z-10">
        <div
          className={cn(
            "max-w-4xl mx-auto text-center transition-all duration-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Start Today</span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            Ready to Transform Your{' '}
            <span className="gradient-text">Sales Journey?</span>
          </h2>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            Join thousands of sales professionals who are closing more deals with
            confidence and authenticity. Your future self will thank you.
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {benefits.map((benefit, index) => (
              <div
                key={benefit}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 animate-fade-in-up",
                  isVisible ? "opacity-100" : "opacity-0"
                )}
                style={{ animationDelay: `${(index + 2) * 100}ms` }}
              >
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div
            className={cn(
              "flex flex-col sm:flex-row gap-4 justify-center items-center transition-all duration-700 delay-300",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <Link href="/auth/signup">
              <Button size="lg" className="btn-pill gradient-bg text-white h-14 px-10 text-base group">
                Start Closing Better
                <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="#pricing">
              <Button
                size="lg"
                variant="outline"
                className="btn-pill h-14 px-10 text-base hover:bg-muted"
              >
                View Pricing
              </Button>
            </Link>
          </div>

          {/* Trust note */}
          <p className="mt-6 text-sm text-muted-foreground">
            Over 5,000 sales professionals trust CloseFlow
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
