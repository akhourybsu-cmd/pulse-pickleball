import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, Building2, ArrowRight } from "lucide-react";

export const SplitCTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
            Ready to get started?
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            Join the PULSE community today and elevate your pickleball experience.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="group h-14 px-8 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:shadow-xl hover:shadow-primary/25 hover:scale-105 transition-all duration-300"
            >
              <User className="mr-2 h-5 w-5" />
              Create Player Account
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              onClick={() => navigate("/venues")}
              className="group h-14 px-8 text-lg font-semibold bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground hover:shadow-xl hover:shadow-secondary/25 hover:scale-105 transition-all duration-300"
            >
              <Building2 className="mr-2 h-5 w-5" />
              Claim Your Venue
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
