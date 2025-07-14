import { 
  Brain, 
  Clock, 
  MessageSquare, 
  LineChart, 
  Zap, 
  Layers, 
  Code, 
  HeartHandshake 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Features = () => {
  const features = [
    {
      icon: <Brain className="h-10 w-10 text-primary" />,
      title: "AI-Powered Insights",
      description: "Get real-time guidance based on conversation analysis, customer signals, and proven closing techniques."
    },
    {
      icon: <MessageSquare className="h-10 w-10 text-primary" />,
      title: "Keyword Recognition",
      description: "Instantly identify customer intent, objections, and buying signals through advanced conversation analysis."
    },
    {
      icon: <Layers className="h-10 w-10 text-primary" />,
      title: "Customizable Templates",
      description: "Choose from multiple sales approach templates or create your own to match your personal style."
    },
    {
      icon: <Clock className="h-10 w-10 text-primary" />,
      title: "Practice Mode",
      description: "Perfect your approach with AI-simulated scenarios before taking on real calls."
    },
    {
      icon: <LineChart className="h-10 w-10 text-primary" />,
      title: "Performance Analytics",
      description: "Track your progress, identify patterns, and continuously improve your sales approach."
    },
    {
      icon: <Zap className="h-10 w-10 text-primary" />,
      title: "Real-time Prompts",
      description: "Receive tactical suggestions at the perfect moment during your live sales conversations."
    },
    {
      icon: <Code className="h-10 w-10 text-primary" />,
      title: "Chrome Extension",
      description: "Seamlessly integrate with your existing calling platforms through our browser extension."
    },
    {
      icon: <HeartHandshake className="h-10 w-10 text-primary" />,
      title: "Authentic Connection",
      description: "Build genuine rapport while maintaining strategic direction in every conversation."
    }
  ];

  return (
    <section className="py-24 bg-muted/50" id="features">
      <div className="container">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            Designed for Closers Who Care
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Tools that enhance your natural selling abilities rather than replace them.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-none shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="text-center">
                <div className="mb-6 flex justify-center">{feature.icon}</div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;