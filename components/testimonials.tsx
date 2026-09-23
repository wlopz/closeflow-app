'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star as StarIcon, Quote, Sparkles } from "lucide-react";
import { cn } from '@/lib/utils';

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Sales Director",
    company: "TechVision Inc.",
    content: "CloseFlow has transformed our sales process. Our team closes 22% more deals since we started using the real-time guidance during calls.",
    avatar: "SJ",
    rating: 5,
    highlight: "22% more deals closed",
  },
  {
    name: "Michael Chen",
    role: "Account Executive",
    company: "GrowthLabs",
    content: "As someone who doesn't like rigid scripts, I love how CloseFlow gives me the structure I need while letting my authentic style shine through.",
    avatar: "MC",
    rating: 5,
    highlight: "Authentic selling style",
  },
  {
    name: "Priya Patel",
    role: "Sales Manager",
    company: "Elevate Solutions",
    content: "The practice mode is invaluable for training new team members. They build confidence faster and develop their own authentic selling voice.",
    avatar: "PP",
    rating: 5,
    highlight: "Faster team onboarding",
  },
  {
    name: "Derek Williams",
    role: "Senior Closer",
    company: "Momentum Partners",
    content: "I was skeptical about AI in sales, but CloseFlow feels like having a sales coach in my ear. It's subtle but incredibly effective.",
    avatar: "DW",
    rating: 5,
    highlight: "AI coaching success",
  },
  {
    name: "Amanda Foster",
    role: "VP of Sales",
    company: "Revenue Labs",
    content: "We've tried many sales tools, but CloseFlow is different. It actually helps our team have better conversations, not just track metrics.",
    avatar: "AF",
    rating: 5,
    highlight: "Better conversations",
  },
  {
    name: "James Rodriguez",
    role: "Account Manager",
    company: "ScaleUp Inc.",
    content: "The real-time prompts have saved multiple deals for me. It catches buying signals I would have missed and helps me navigate objections smoothly.",
    avatar: "JR",
    rating: 5,
    highlight: "Deal-saving insights",
  },
];

const Testimonials = () => {
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
      id="testimonials"
      className="section-padding relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute top-1/3 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />

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
            <span className="text-sm font-medium">Customer Stories</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            Loved by{' '}
            <span className="gradient-text">Sales Professionals</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            See how CloseFlow is helping closers connect and convert with confidence.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={`${testimonial.name}-${index}`}
              className={cn(
                "group relative glass rounded-2xl p-6 transition-all duration-500 hover:shadow-xl hover:border-primary/30 animate-fade-in-up",
                isVisible ? "opacity-100" : "opacity-0"
              )}
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              {/* Quote icon */}
              <div className="absolute top-6 right-6 text-primary/20">
                <Quote className="h-8 w-8" />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className={cn(
                      "h-4 w-4 transition-all duration-300",
                      i < testimonial.rating
                        ? "text-amber-500 fill-amber-500"
                        : "text-muted"
                    )}
                  />
                ))}
              </div>

              {/* Highlight badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
                <StarIcon className="h-3 w-3 fill-primary" />
                {testimonial.highlight}
              </div>

              {/* Content */}
              <p className="text-muted-foreground leading-relaxed mb-6">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-cyan-500 text-white font-medium text-sm">
                    {testimonial.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.role}, {testimonial.company}
                  </p>
                </div>
              </div>

              {/* Hover gradient effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
            </div>
          ))}
        </div>

        {/* Trust indicators */}
        <div
          className={cn(
            "mt-16 pt-16 border-t border-border transition-all duration-700 delay-500",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {['SJ', 'MC', 'PP', 'DW'].map((initials, i) => (
                  <Avatar key={i} className="h-8 w-8 border-2 border-background">
                    <AvatarFallback className="text-xs bg-gradient-to-br from-primary to-cyan-500 text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-sm text-muted-foreground ml-2">5,000+ sales pros</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} className="h-4 w-4 text-amber-500 fill-amber-500" />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">4.9/5 average rating</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">500K+ calls analyzed</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;