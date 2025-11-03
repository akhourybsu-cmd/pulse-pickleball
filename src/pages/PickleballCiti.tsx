import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { LogOut, User as UserIcon } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/pulse-logo-new.png";
import { UpcomingEvents } from "@/components/citi-events/UpcomingEvents";
import { Footer } from "@/components/Footer";

// Pickleball Citi court ID
const PICKLEBALL_CITI_ID = "e4ca6eb3-3c78-475a-b8c2-e7b14e7e8906";

export default function PickleballCiti() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      toast({
        title: "Session Expired",
        description: "Please sign in to view events",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    
    setCurrentUserId(user.id);

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    setIsAdmin(!!roleData);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate(`/profile/${currentUserId}`)} 
              className="rounded-full"
            >
              <UserIcon className="h-[1.2rem] w-[1.2rem]" />
              <span className="sr-only">View Profile</span>
            </Button>
            <ThemeToggle />
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative border-b-2"
        style={{
          background: 'linear-gradient(180deg, #E8FBD5 0%, #FFFFFF 80%)',
          borderBottomColor: 'rgba(169, 220, 61, 0.15)',
        }}
      >
        <div className="container mx-auto py-8 px-4 md:py-12">
          <div className="text-center space-y-4">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold"
              style={{
                color: '#0E4C58',
                letterSpacing: '0.02em',
                textShadow: '0px 2px 4px rgba(169, 220, 61, 0.25)',
              }}
            >
              Pickleball City
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl max-w-2xl mx-auto"
              style={{ 
                color: '#53797E',
                fontWeight: 400,
              }}
            >
              Your premier pickleball destination in Cranston, Rhode Island
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 0.3, scaleX: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut", delay: 0.3 }}
              className="h-1 w-32 mx-auto rounded-full"
              style={{ backgroundColor: '#A9DC3D' }}
            />
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 bg-gradient-to-br from-background via-muted/10 to-background py-8">
        <div className="container mx-auto px-4 space-y-6">
          <UpcomingEvents courtId={PICKLEBALL_CITI_ID} isAdmin={isAdmin} />
          
          {/* Additional Info Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center py-8"
          >
            <p className="text-muted-foreground">
              Want to explore other courts and connect with more players?
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate("/court/connector")}
            >
              View Court Connector
            </Button>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
