import { Link } from "react-router-dom";
import { APP_VERSION, LAST_UPDATED } from "@/config/version";

export const Footer = () => {
  return (
    <footer className="border-t bg-secondary/30 py-4 mt-auto">
      <div className="container mx-auto px-4 text-center">
        <p className="text-xs text-muted-foreground">
          PULSE{" "}
          <Link 
            to="/changelog" 
            className="hover:text-primary underline-offset-2 hover:underline transition-colors"
          >
            v{APP_VERSION}
          </Link>
          {" "}• Last updated: {LAST_UPDATED}
        </p>
      </div>
    </footer>
  );
};
