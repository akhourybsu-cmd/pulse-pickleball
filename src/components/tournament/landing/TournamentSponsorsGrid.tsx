import { ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface Sponsor {
  name?: string;
  logo_url?: string;
  tagline?: string;
  link?: string;
}

interface TournamentSponsorsGridProps {
  sponsors: Sponsor[] | null;
}

export function TournamentSponsorsGrid({ sponsors }: TournamentSponsorsGridProps) {
  const validSponsors = sponsors?.filter(s => s.logo_url || s.name) || [];
  
  if (validSponsors.length === 0) return null;

  return (
    <section className="py-16 md:py-24 px-4 bg-gradient-to-br from-background via-muted/10 to-background">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Proudly Supported By
          </h2>
          <p className="text-muted-foreground text-lg">
            These partners help bring this event to life
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {validSponsors.map((sponsor, index) => {
            // Ensure URL has proper protocol
            let sponsorUrl = sponsor.link || '';
            if (sponsorUrl && !sponsorUrl.match(/^https?:\/\//i)) {
              sponsorUrl = 'https://' + sponsorUrl;
            }

            const Component = sponsor.link ? motion.a : motion.div;
            const linkProps = sponsor.link ? {
              href: sponsorUrl,
              target: "_blank",
              rel: "noopener noreferrer",
            } : {};

            return (
              <Component
                key={index}
                {...linkProps}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className={`group relative bg-card rounded-xl p-6 border-2 border-border hover:border-primary/40 transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[160px] shadow-sm hover:shadow-lg ${
                  sponsor.link ? 'cursor-pointer' : ''
                }`}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {sponsor.logo_url && (
                  <div className="relative z-10 mb-3 flex items-center justify-center h-16">
                    <img
                      src={sponsor.logo_url}
                      alt={sponsor.name || "Sponsor logo"}
                      className="max-h-full max-w-[140px] object-contain"
                    />
                  </div>
                )}

                {sponsor.name && (
                  <p className="relative z-10 font-semibold text-sm text-foreground">
                    {sponsor.name}
                  </p>
                )}

                {sponsor.tagline && (
                  <p className="relative z-10 text-xs text-muted-foreground mt-1">
                    {sponsor.tagline}
                  </p>
                )}

                {sponsor.link && (
                  <p className="relative z-10 text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1">
                    Visit <ExternalLink className="h-3 w-3" />
                  </p>
                )}
              </Component>
            );
          })}
        </div>
      </div>
    </section>
  );
}
