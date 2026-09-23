'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const logos = [
  { name: 'Acme Corp', width: 120 },
  { name: 'TechFlow', width: 100 },
  { name: 'SalesForce', width: 110 },
  { name: 'GrowthLabs', width: 130 },
  { name: 'DataDriven', width: 100 },
  { name: 'CloudSync', width: 110 },
];

const stats = [
  { value: '20%', label: 'Average increase in close rate' },
  { value: '500K+', label: 'Sales calls analyzed' },
  { value: '50M+', label: 'Conversation minutes processed' },
];

const SocialProof = () => {
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
      className="py-20 border-y border-border bg-muted/30 overflow-hidden"
    >
      <div className="container-wide">
        {/* Header */}
        <div
          className={cn(
            "text-center mb-12 transition-all duration-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <p className="text-sm font-medium text-muted-foreground mb-6">
            Trusted by sales teams at forward-thinking companies
          </p>
        </div>

        {/* Scrolling Logos */}
        <div
          className={cn(
            "relative transition-all duration-700 delay-200",
            isVisible ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Gradient masks on sides */}
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-muted/30 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-muted/30 to-transparent z-10 pointer-events-none" />

          {/* Logo scroll container */}
          <div className="flex overflow-hidden">
            <div className="flex gap-12 animate-scroll">
              {/* Double the logos for seamless loop */}
              {[...logos, ...logos].map((logo, index) => (
                <div
                  key={`${logo.name}-${index}`}
                  className="flex items-center justify-center flex-shrink-0 opacity-40 hover:opacity-70 transition-opacity duration-300"
                >
                  <span className="text-xl font-bold tracking-wider text-muted-foreground">
                    {logo.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 transition-all duration-700 delay-300",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="text-center animate-fade-in-up"
              style={{ animationDelay: `${(index + 4) * 100}ms` }}
            >
              <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                {stat.value}
              </div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CSS for scrolling animation */}
      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll 25s linear infinite;
        }
      `}</style>
    </section>
  );
};

export default SocialProof;
