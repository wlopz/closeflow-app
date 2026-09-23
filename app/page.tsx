import MainNav from '@/components/main-nav';
import Hero from '@/components/hero';
import SocialProof from '@/components/social-proof';
import Features from '@/components/features';
import HowItWorks from '@/components/how-it-works';
import Testimonials from '@/components/testimonials';
import Pricing from '@/components/pricing';
import CTASection from '@/components/cta-section';
import Footer from '@/components/footer';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <main className="flex-1">
        <Hero />
        <SocialProof />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}