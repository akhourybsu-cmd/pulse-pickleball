import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Star, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/pulse-logo-premium.svg";
import pickleballCitiLogo from "@/assets/pickleball-citi-logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";

const membershipTiers = [
  {
    name: "Drop-In Player",
    subtitle: "(Non-Member)",
    price: "$15 for 2 hours",
    features: [
      "$15 for 2 hours open play",
      "$60/hour private court"
    ],
    featured: false
  },
  {
    name: "Basic Plan",
    price: "$29.99/month",
    features: [
      "$9.99 per visit",
      "$50/hour private court",
      "7-day advance reservations",
      "Free paddle demos"
    ],
    featured: false
  },
  {
    name: "Upgraded Plan",
    price: "$49.99/month",
    features: [
      "$6.99 per visit",
      "$50/hour private court",
      "10-day advance reservations",
      "Optional 24/7 add-on: $39.99/month",
      "10% off leagues and equipment"
    ],
    featured: false
  },
  {
    name: "Couples Plan",
    price: "$99/month",
    subtitle: "(2 players)",
    features: [
      "$3.99 per visit",
      "$45/hour private court",
      "14-day advance reservations",
      "Titan ball machine: $25/session",
      "10% off leagues and equipment"
    ],
    featured: false
  },
  {
    name: "PREMIUM 24/7 ACCESS",
    price: "$109.99/month",
    subtitle: "Unlimited flexibility & perks",
    features: [
      "2 FREE open plays per week (8/month, non-accruing)",
      "$5.99 per visit after free plays",
      "$45/hour private court",
      "14-day advance reservations",
      "24/7 private court rental with keyless entry",
      "Bring friends anytime",
      "10% off Titan ball machine, leagues & equipment",
      "Free paddle demos"
    ],
    featured: true
  }
];

export default function PickleballCitiMemberships() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to="/player/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <div className="container mx-auto px-4 pt-1.5 pb-16">
        <Button
          variant="outline"
          onClick={() => navigate('/court/board/836003fb-fbd7-429c-8973-67ac6766a511')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-7xl mx-auto"
        >
          <div className="flex items-center justify-center gap-6 mb-4">
            <img 
              src={pickleballCitiLogo} 
              alt="Pickleball Citi" 
              className="h-32 md:h-40 w-auto"
            />
            <h1 className="text-4xl md:text-5xl font-bold" style={{ color: '#0E4C58' }}>
              Memberships
            </h1>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-center text-lg md:text-xl mb-2"
            style={{ color: '#0E4C58' }}
          >
            New Month-to-Month Plans Starting October 1, 2025
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center mb-12 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" style={{ color: '#B9E43B' }} />
            <p className="text-base md:text-lg font-medium" style={{ color: '#0E4C58' }}>
              Referral Bonus: Bring a friend who signs up and receive a FREE 2-hour private court rental!
            </p>
            <Sparkles className="w-5 h-5" style={{ color: '#B9E43B' }} />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {membershipTiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
                className={tier.featured ? "md:col-span-2" : ""}
              >
                <Card 
                  className={`h-full transition-all duration-300 hover:shadow-xl ${
                    tier.featured 
                      ? "border-4 relative overflow-hidden" 
                      : "border-2 hover:border-lime-300"
                  }`}
                  style={{
                    borderColor: tier.featured ? '#B9E43B' : 'rgba(169, 220, 61, 0.3)',
                    background: tier.featured 
                      ? 'linear-gradient(135deg, #0E4C58 0%, #1a6b7a 100%)' 
                      : 'white'
                  }}
                >
                  {tier.featured && (
                    <div className="absolute top-4 right-4">
                      <Star className="w-8 h-8 fill-[#B9E43B]" style={{ color: '#B9E43B' }} />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle 
                      className={`text-2xl font-bold ${tier.featured ? 'text-white' : ''}`}
                      style={!tier.featured ? { color: '#0E4C58' } : {}}
                    >
                      {tier.name}
                    </CardTitle>
                    {tier.subtitle && (
                      <p 
                        className={`text-sm ${tier.featured ? 'text-white/80' : 'text-slate-600'}`}
                      >
                        {tier.subtitle}
                      </p>
                    )}
                    <p 
                      className={`text-3xl font-bold mt-2 ${tier.featured ? '' : ''}`}
                      style={{ color: tier.featured ? '#B9E43B' : '#0E4C58' }}
                    >
                      {tier.price}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ul className={`space-y-2 ${tier.featured ? 'md:columns-2 md:gap-8' : ''}`}>
                      {tier.features.map((feature, idx) => (
                        <li 
                          key={idx} 
                          className={`flex items-start gap-2 ${tier.featured ? 'text-white/90' : 'text-slate-700'}`}
                        >
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tier.featured ? '#B9E43B' : '#A9DC3D' }} />
                          <span className="text-sm leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="mt-8 text-center"
          >
            <p className="text-lg mb-4" style={{ color: '#0E4C58' }}>
              Ready to join Pickleball Citi?
            </p>
            <Button
              asChild
              size="lg"
              className="gap-2 text-lg px-8 py-6 rounded-full"
              style={{
                backgroundColor: '#B9E43B',
                color: '#0E4C58',
              }}
            >
              <a href="https://pickleballciti.com/" target="_blank" rel="noopener noreferrer">
                Sign Up on Official Website
              </a>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
