'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Headphones, Mic, Brain, TrendingUp, ArrowRight, Play, CircleCheck as CheckCircle2, Sparkles } from 'lucide-react';

const tabs = [
  {
    id: 'live-call',
    name: 'Live Call',
    description: 'Real-time AI assistance during your calls',
  },
  {
    id: 'practice',
    name: 'Practice Mode',
    description: 'Simulate calls with AI feedback',
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Track and improve your performance',
  },
];

const steps: Record<string, Array<{
  number: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: string;
}>> = {
  'live-call': [
    {
      number: 1,
      title: 'Connect to your call',
      description: 'Launch CloseFlow before your sales call. It works with Zoom, Teams, Google Meet, and any video platform.',
      icon: Headphones,
      highlight: 'One-click setup',
    },
    {
      number: 2,
      title: 'AI listens in real-time',
      description: 'Our AI transcribes and analyzes the conversation as it happens, identifying key moments and opportunities.',
      icon: Mic,
      highlight: 'Private & secure',
    },
    {
      number: 3,
      title: 'Get instant coaching',
      description: 'Receive subtle, timely suggestions for handling objections, identifying buying signals, and closing effectively.',
      icon: Brain,
      highlight: 'Context-aware',
    },
    {
      number: 4,
      title: 'Close with confidence',
      description: 'Navigate conversations naturally while having AI-powered insights to guide your strategy.',
      icon: TrendingUp,
      highlight: 'Higher close rates',
    },
  ],
  'practice': [
    {
      number: 1,
      title: 'Choose a scenario',
      description: 'Select from common sales situations: objection handling, discovery calls, demos, or negotiations.',
      icon: Headphones,
      highlight: '20+ scenarios',
    },
    {
      number: 2,
      title: 'Practice with AI customer',
      description: 'Engage with realistic AI that responds naturally to your approach, challenging you to adapt.',
      icon: Mic,
      highlight: 'Adaptive AI',
    },
    {
      number: 3,
      title: 'Receive detailed feedback',
      description: 'Get coached on your talk ratio, question quality, objection handling, and closing techniques.',
      icon: Brain,
      highlight: 'Actionable insights',
    },
    {
      number: 4,
      title: 'Improve with every session',
      description: 'Track your progress over time and see measurable improvement in your selling skills.',
      icon: TrendingUp,
      highlight: 'Measurable growth',
    },
  ],
  'analytics': [
    {
      number: 1,
      title: 'Review performance',
      description: 'See your close rates, call durations, and improvement trends with clear visualizations.',
      icon: Headphones,
      highlight: 'Easy to understand',
    },
    {
      number: 2,
      title: 'Identify patterns',
      description: 'Discover which approaches work best, where you lose deals, and what drives success.',
      icon: Mic,
      highlight: 'Data-driven',
    },
    {
      number: 3,
      title: 'Listen to key moments',
      description: 'Jump to important parts of calls with AI-annotated highlights and transcripts.',
      icon: Brain,
      highlight: 'Save time',
    },
    {
      number: 4,
      title: 'Set and achieve goals',
      description: 'Create personalized improvement targets and track your path to mastery.',
      icon: TrendingUp,
      highlight: 'Progress tracking',
    },
  ],
};

const HowItWorks = () => {
  const [activeTab, setActiveTab] = useState('live-call');
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

  const currentSteps = steps[activeTab];

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
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
            <Play className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Simple to use</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            How{' '}
            <span className="gradient-text">CloseFlow</span> Works
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Intuitive guidance that integrates seamlessly with your sales process.
            Start seeing results from your very first call.
          </p>
        </div>

        {/* Tabs */}
        <div
          className={cn(
            "flex flex-wrap justify-center gap-4 mb-16 transition-all duration-700 delay-200",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "group relative px-6 py-4 rounded-2xl transition-all duration-300",
                activeTab === tab.id
                  ? "bg-card shadow-lg border border-primary/30"
                  : "bg-muted/50 hover:bg-muted border border-transparent hover:border-border"
              )}
            >
              <div className="text-left">
                <div className="font-semibold mb-1">{tab.name}</div>
                <div className="text-sm text-muted-foreground">{tab.description}</div>
              </div>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Steps Content */}
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-cyan-500 to-transparent" />

            {/* Steps */}
            <div className="space-y-8">
              {currentSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={`${activeTab}-${step.number}`}
                    className={cn(
                      "relative flex gap-6 items-start animate-fade-in-up",
                      isVisible ? "opacity-100" : "opacity-0"
                    )}
                    style={{ animationDelay: `${(index + 3) * 100}ms` }}
                  >
                    {/* Step number/icon */}
                    <div className="relative z-10 flex-shrink-0">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shadow-lg">
                        <Icon className="h-7 w-7 text-white" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          Step {step.number}
                        </span>
                        {step.highlight && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            <Sparkles className="h-3 w-3" />
                            {step.highlight}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                      <p className="text-muted-foreground leading-relaxed max-w-lg">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom CTA */}
          <div
            className={cn(
              "text-center mt-12 pt-8 border-t border-border transition-all duration-700 delay-700",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <p className="text-muted-foreground mb-4">
              Ready to see these results for yourself?
            </p>
            <button className="inline-flex items-center gap-2 btn-pill gradient-bg text-white font-medium">
              Try it free for 14 days
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Features list */}
        <div
          className={cn(
            "grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 pt-16 border-t border-border transition-all duration-700 delay-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          {[
            'No plugin required',
            'Works with any video app',
            'End-to-end encrypted',
            'Enterprise grade security',
          ].map((feature, index) => (
            <div
              key={feature}
              className="flex items-center gap-2 animate-fade-in-up"
              style={{ animationDelay: `${(index + 8) * 100}ms` }}
            >
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
