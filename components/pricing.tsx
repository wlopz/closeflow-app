'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles, Zap, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';

const plans = [
  {
    name: "Starter",
    price: 29,
    description: "Perfect for individual sales professionals",
    icon: Zap,
    features: [
      "Real-time call guidance",
      "Basic sales templates",
      "Call recording & transcriptions",
      "Chrome extension access",
      "5 practice sessions/month",
      "7-day call history"
    ],
    cta: "Start free trial",
    popular: false,
    gradient: "from-green-500 to-emerald-500",
  },
  {
    name: "Professional",
    price: 79,
    description: "For serious closers looking to maximize results",
    icon: Sparkles,
    features: [
      "Everything in Starter",
      "Advanced AI guidance",
      "Custom sales templates",
      "Unlimited practice sessions",
      "30-day call history",
      "Performance analytics",
      "Email & chat support"
    ],
    cta: "Get started",
    popular: true,
    gradient: "from-primary to-cyan-500",
  },
  {
    name: "Team",
    price: 199,
    description: "For sales teams and organizations",
    icon: Building2,
    features: [
      "Everything in Professional",
      "5 user accounts included",
      "Team performance analytics",
      "Manager dashboard",
      "Training & onboarding",
      "Unlimited call history",
      "Priority support",
      "SSO & advanced security"
    ],
    cta: "Contact sales",
    popular: false,
    gradient: "from-violet-500 to-purple-500",
  }
];

const Pricing = () => {
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
      id="pricing"
      className="section-padding relative overflow-hidden bg-muted/30"
    >
      {/* Background */}
      <div className="absolute inset-0 grid-pattern opacity-20" />

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
            <span className="text-sm font-medium">Simple Pricing</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            Choose Your{' '}
            <span className="gradient-text">Path to Success</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Start with a 14-day free trial. No credit card required. Cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={cn(
                  "group relative rounded-2xl transition-all duration-500 animate-fade-in-up",
                  plan.popular
                    ? "lg:-mt-4 lg:mb-4"
                    : "",
                  isVisible ? "opacity-100" : "opacity-0"
                )}
                style={{ animationDelay: `${(index + 1) * 100}ms` }}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <div className="gradient-bg text-white text-sm font-medium py-1.5 px-4 rounded-full shadow-lg">
                      Most Popular
                    </div>
                  </div>
                )}

                {/* Card */}
                <div
                  className={cn(
                    "h-full p-6 lg:p-8 rounded-2xl transition-all duration-500",
                    plan.popular
                      ? "glass border-2 border-primary/30 shadow-xl"
                      : "bg-card border border-border hover:border-primary/30 hover:shadow-lg"
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "inline-flex items-center justify-center w-12 h-12 rounded-xl mb-6 transition-transform duration-300 group-hover:scale-110",
                      "bg-gradient-to-br",
                      plan.gradient,
                      "text-white shadow-lg"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  {/* Plan name */}
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-extrabold">${plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-6">
                    {plan.description}
                  </p>

                  {/* CTA */}
                  <Link href="/auth/signup" className="block">
                    <Button
                      className={cn(
                        "w-full py-3 font-medium",
                        plan.popular
                          ? "gradient-bg text-white"
                          : ""
                      )}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>

                  {/* Features */}
                  <div className="mt-8 pt-6 border-t border-border">
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-sm"
                        >
                          <Check
                            className={cn(
                              "h-5 w-5 flex-shrink-0",
                              plan.popular ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Hover glow effect for popular plan */}
                {plan.popular && (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-cyan-500/10 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500 -z-10" />
                )}
              </div>
            );
          })}
        </div>

        {/* Enterprise CTA */}
        <div
          className={cn(
            "mt-16 text-center transition-all duration-700 delay-500",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl bg-card border border-border">
            <div className="text-center sm:text-left">
              <p className="font-semibold">Need a custom plan for your enterprise?</p>
              <p className="text-sm text-muted-foreground">Volume discounts and dedicated support available.</p>
            </div>
            <Link href="/contact">
              <Button variant="outline" className="btn-pill">
                Contact Sales
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Trust indicators */}
        <div
          className={cn(
            "mt-12 flex flex-wrap justify-center items-center gap-6 text-sm text-muted-foreground transition-all duration-700 delay-700",
            isVisible ? "opacity-100" : "opacity-0"
          )}
        >
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            14-day free trial
          </span>
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            No credit card required
          </span>
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            Cancel anytime
          </span>
        </div>
      </div>
    </section>
  );
};

export default Pricing;