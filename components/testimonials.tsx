import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarIcon } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Sales Director, TechVision Inc.",
    content: "CloseFlow has transformed our sales process. Our team closes 22% more deals since we started using the real-time guidance during calls.",
    avatar: "SJ",
    rating: 5
  },
  {
    name: "Michael Chen",
    role: "Account Executive, GrowthLabs",
    content: "As someone who doesn't like rigid scripts, I love how CloseFlow gives me the structure I need while letting my authentic style shine through.",
    avatar: "MC",
    rating: 5
  },
  {
    name: "Priya Patel",
    role: "Sales Manager, Elevate Solutions",
    content: "The practice mode is invaluable for training new team members. They build confidence faster and develop their own authentic selling voice.",
    avatar: "PP",
    rating: 5
  },
  {
    name: "Derek Williams",
    role: "Senior Closer, Momentum Partners",
    content: "I was skeptical about AI in sales, but CloseFlow feels like having a sales coach in my ear. It's subtle but incredibly effective.",
    avatar: "DW",
    rating: 4
  }
];

const Testimonials = () => {
  return (
    <section className="py-20 bg-muted/30" id="testimonials">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Loved by Sales Professionals
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            See how CloseFlow is helping closers connect and convert with confidence.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="h-full">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Avatar>
                    <AvatarFallback>{testimonial.avatar}</AvatarFallback>
                  </Avatar>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <StarIcon 
                        key={i} 
                        className={`h-4 w-4 ${i < testimonial.rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} 
                      />
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="mb-4">"{testimonial.content}"</p>
              </CardContent>
              <CardFooter className="flex flex-col items-start pt-0">
                <p className="font-semibold">{testimonial.name}</p>
                <p className="text-sm text-muted-foreground">{testimonial.role}</p>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;