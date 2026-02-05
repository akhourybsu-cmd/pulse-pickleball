import { Link } from "react-router-dom";
import { Github, Twitter, Instagram, Youtube } from "lucide-react";

const productLinks = [
  { label: "Players", href: "/players" },
  { label: "Venues", href: "/venues" },
  { label: "Events", href: "/events/browse" },
  { label: "Community", href: "/player/community" },
];

// Company and Legal links removed - pages don't exist yet
// These can be added back when the pages are created:
// const companyLinks = [
//   { label: "About", href: "/about" },
//   { label: "Contact", href: "/contact" },
//   { label: "Careers", href: "/careers" },
// ];
// const legalLinks = [
//   { label: "Privacy Policy", href: "/privacy" },
//   { label: "Terms of Service", href: "/terms" },
// ];

const socialLinks = [
  { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
  { icon: Youtube, href: "https://youtube.com", label: "YouTube" },
  { icon: Github, href: "https://github.com", label: "GitHub" },
];

export const HomepageFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted/50 border-t border-border">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4 text-foreground">Product</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect - Social Links section */}
          <div>
            <h4 className="font-semibold mb-4 text-foreground">Connect</h4>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent">
                <span className="text-primary-foreground font-bold text-sm">P</span>
              </div>
              <span className="font-display text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                PULSE
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              The all-in-one pickleball platform for players and venues.
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            © {currentYear} PULSE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
