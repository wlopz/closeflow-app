import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const Pricing = () => {
  const plans = [
    {
      name: "Starter",
      price: 29,
      description: "Perfect for individual sales professionals",
      features: [
        "Real-time call guidance",
        "Basic sales templates",
        "Call recording & transcriptions",
        "Chrome extension access",
        "5 practice sessions/month",
        "7-day call history"
      ],
      cta: "Start for free",
      popular: false
    },
    {
      name: "Professional",
      price: 79,
      description: "For serious closers looking to maximize results",
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
      popular: true
    },
    {
      name: "Team",
      price: 199,
      description: "For sales teams and organizations",
      features: [
        "Everything in Professional",
        "5 user accounts",
        "Team performance analytics",
        "Manager dashboard",
        "Training & onboarding",
        "Unlimited call history",
        "Priority support",
        "90-day call history"
      ],
      cta: "Contact sales",
      popular: false
    }
  ];

  return (
    <section className="py-24" id="pricing">
      <div className="container">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Choose the plan that fits your needs. All plans include a 14-day free trial.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`flex flex-col hover:shadow-lg transition-shadow duration-300 ${plan.popular ? 'border-primary shadow-lg relative scale-105' : ''}`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-sm font-medium py-1 px-3 rounded-full">
                  Most Popular
                </div>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="mt-4 flex items-baseline text-5xl font-extrabold">
                  ${plan.price}
                  <span className="ml-1 text-2xl font-medium text-muted-foreground">/mo</span>
                </div>
                <CardDescription className="mt-4 text-base">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-4">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex">
                      <CheckIcon className="h-5 w-5 text-primary flex-shrink-0 mr-3" />
                      <span className="leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Link href="/signup" className="w-full">
                  <Button 
                    className="w-full py-3 text-lg" 
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
        
        <div className="mt-16 text-center">
          <p className="text-lg text-muted-foreground">
            Need a custom plan for your enterprise? <Link href="/contact" className="text-primary font-medium">Contact us</Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;