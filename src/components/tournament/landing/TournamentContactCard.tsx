import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, MessageCircle, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface SocialLink {
  label: string;
  url: string;
}

interface TournamentContactCardProps {
  organizerName?: string | null;
  organizerEmail?: string | null;
  organizerPhone?: string | null;
  organizerMessage?: string | null;
  preferredContact?: string | null;
  socialLinks?: SocialLink[] | null;
}

export function TournamentContactCard({
  organizerName,
  organizerEmail,
  organizerPhone,
  organizerMessage,
  preferredContact,
  socialLinks,
}: TournamentContactCardProps) {
  const hasContact = organizerName || organizerEmail || organizerPhone;
  
  if (!hasContact) return null;

  return (
    <section className="py-12 md:py-24 px-4">
      <div className="container mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6 md:mb-8"
        >
          <h2 className="text-2xl md:text-4xl font-bold text-foreground mb-2 md:mb-3">
            Questions?
          </h2>
          <p className="text-muted-foreground">
            Reach out to the tournament organizer
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-2 border-primary/20 hover:border-primary/40 transition-colors">
            <CardContent className="p-4 md:p-8 space-y-4 md:space-y-6">
              {/* Organizer Name */}
              {organizerName && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {organizerName}
                  </p>
                </div>
              )}

              {/* Contact Methods */}
              <div className="flex flex-col gap-3">
                {organizerEmail && (
                  <a
                    href={`mailto:${organizerEmail}`}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all duration-200 group ${
                      preferredContact === 'email'
                        ? 'border-primary bg-primary/5 hover:bg-primary/10'
                        : 'border-border hover:border-primary/40 hover:bg-muted/50'
                    }`}
                  >
                    <Mail className={`h-5 w-5 ${
                      preferredContact === 'email' ? 'text-primary' : 'text-muted-foreground'
                    } group-hover:text-primary transition-colors`} />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-foreground">
                        {organizerEmail}
                      </p>
                      {preferredContact === 'email' && (
                        <p className="text-xs text-primary font-semibold">
                          Preferred contact method
                        </p>
                      )}
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                )}

                {organizerPhone && (
                  <a
                    href={`tel:${organizerPhone}`}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all duration-200 group ${
                      preferredContact === 'phone'
                        ? 'border-primary bg-primary/5 hover:bg-primary/10'
                        : 'border-border hover:border-primary/40 hover:bg-muted/50'
                    }`}
                  >
                    <Phone className={`h-5 w-5 ${
                      preferredContact === 'phone' ? 'text-primary' : 'text-muted-foreground'
                    } group-hover:text-primary transition-colors`} />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-foreground">
                        {organizerPhone}
                      </p>
                      {preferredContact === 'phone' && (
                        <p className="text-xs text-primary font-semibold">
                          Preferred contact method
                        </p>
                      )}
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                )}
              </div>

              {/* Personal Message */}
              {organizerMessage && (
                <div className="pt-4 border-t">
                  <div className="flex items-start gap-3">
                    <MessageCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm italic text-muted-foreground leading-relaxed">
                      "{organizerMessage}"
                    </p>
                  </div>
                </div>
              )}

              {/* Social Links */}
              {socialLinks && socialLinks.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-semibold mb-4 text-center">Follow us</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {socialLinks.map((link, i) => (
                      <motion.a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.05, y: -2 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <span className="font-medium text-sm">{link.label}</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </motion.a>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
