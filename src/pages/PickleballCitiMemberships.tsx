import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/pulse-logo-new.png";
import pickleballCitiLogo from "@/assets/pickleball-citi-logo.png";
import membershipsPricing from "@/assets/memberships-pricing.png";

export default function PickleballCitiMemberships() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-5xl mx-auto"
        >
          <div className="flex items-center justify-center gap-6 mb-8">
            <img 
              src={pickleballCitiLogo} 
              alt="Pickleball Citi" 
              className="h-32 md:h-40 w-auto"
            />
            <h1 className="text-4xl md:text-5xl font-bold" style={{ color: '#0E4C58' }}>
              Memberships
            </h1>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
            <img 
              src={membershipsPricing} 
              alt="Pickleball Citi Membership Options" 
              className="w-full h-auto rounded-lg"
            />
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
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
