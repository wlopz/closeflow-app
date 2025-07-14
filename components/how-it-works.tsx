"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { 
  Headphones, 
  ListChecks, 
  MessageSquareText, 
  Gauge
} from 'lucide-react';

const HowItWorks = () => {
  const [activeTab, setActiveTab] = useState('live-call');
  
  const steps = {
    'live-call': [
      {
        title: "Connect to your call",
        description: "Open the CloseFlow Chrome extension before your sales call begins.",
        icon: <Headphones className="h-8 w-8 text-primary" />
      },
      {
        title: "Speak naturally",
        description: "Conduct your call as you normally would. Our AI listens and analyzes in real-time.",
        icon: <MessageSquareText className="h-8 w-8 text-primary" />
      },
      {
        title: "Follow the prompts",
        description: "Receive subtle guidance based on conversation signals and customer responses.",
        icon: <ListChecks className="h-8 w-8 text-primary" />
      },
      {
        title: "Close with confidence",
        description: "Handle objections smoothly and navigate toward a successful close.",
        icon: <Gauge className="h-8 w-8 text-primary" />
      }
    ],
    'practice': [
      {
        title: "Select a scenario",
        description: "Choose from various customer types and sales situations to practice.",
        icon: <ListChecks className="h-8 w-8 text-primary" />
      },
      {
        title: "Role play with AI",
        description: "Engage in realistic conversations with our AI customer simulator.",
        icon: <MessageSquareText className="h-8 w-8 text-primary" />
      },
      {
        title: "Receive feedback",
        description: "Get detailed analysis on your approach, language, and effectiveness.",
        icon: <Gauge className="h-8 w-8 text-primary" />
      },
      {
        title: "Refine and repeat",
        description: "Practice until you've mastered each scenario and objection type.",
        icon: <Headphones className="h-8 w-8 text-primary" />
      }
    ],
    'analytics': [
      {
        title: "Track performance",
        description: "Review your call metrics, close rates, and improvement over time.",
        icon: <Gauge className="h-8 w-8 text-primary" />
      },
      {
        title: "Identify patterns",
        description: "Discover which approaches and responses work best for you.",
        icon: <ListChecks className="h-8 w-8 text-primary" />
      },
      {
        title: "Review calls",
        description: "Listen to recordings with AI annotations highlighting key moments.",
        icon: <Headphones className="h-8 w-8 text-primary" />
      },
      {
        title: "Set goals",
        description: "Establish improvement targets and track your progress toward them.",
        icon: <MessageSquareText className="h-8 w-8 text-primary" />
      }
    ]
  };

  return (
    <section className="py-24" id="how-it-works">
      <div className="container">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            How CloseFlow Works
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Intuitive guidance that integrates seamlessly with your sales process.
          </p>
        </div>
        
        <Tabs defaultValue="live-call" className="w-full max-w-6xl mx-auto" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="live-call">Live Call Assistant</TabsTrigger>
            <TabsTrigger value="practice">Practice Mode</TabsTrigger>
            <TabsTrigger value="analytics">Analytics & Insights</TabsTrigger>
          </TabsList>
          
          {Object.keys(steps).map((tabKey) => (
            <TabsContent key={tabKey} value={tabKey} className="mt-12">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="space-y-10">
                    {steps[tabKey as keyof typeof steps].map((step, index) => (
                      <div key={index} className="flex gap-6">
                        <div className="flex-shrink-0 rounded-full bg-primary/10 p-5">
                          {step.icon}
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                          <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Card className="overflow-hidden border-none shadow-xl">
                  <div className="aspect-video relative bg-muted rounded-md">
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      {activeTab === 'live-call' && (
                        <Image 
                          src="https://images.pexels.com/photos/3756679/pexels-photo-3756679.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                          alt="Live Call Interface"
                          fill
                          className="object-cover"
                        />
                      )}
                      {activeTab === 'practice' && (
                        <Image 
                          src="https://images.pexels.com/photos/7176319/pexels-photo-7176319.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                          alt="Practice Mode Interface"
                          fill
                          className="object-cover"
                        />
                      )}
                      {activeTab === 'analytics' && (
                        <Image 
                          src="https://images.pexels.com/photos/590022/pexels-photo-590022.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                          alt="Analytics Interface"
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
};

export default HowItWorks;