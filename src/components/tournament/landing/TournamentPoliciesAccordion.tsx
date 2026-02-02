import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, CloudRain, Shield, AlertTriangle, StickyNote } from "lucide-react";
import { motion } from "framer-motion";

interface TournamentPoliciesAccordionProps {
  refundPolicy?: string | null;
  weatherPolicy?: string | null;
  conductPolicy?: string | null;
  liabilityPolicy?: string | null;
  extraNotes?: string | null;
  policiesText?: string | null;
}

export function TournamentPoliciesAccordion({
  refundPolicy,
  weatherPolicy,
  conductPolicy,
  liabilityPolicy,
  extraNotes,
  policiesText,
}: TournamentPoliciesAccordionProps) {
  const hasPolicies = refundPolicy || weatherPolicy || conductPolicy || liabilityPolicy || extraNotes || policiesText;
  
  if (!hasPolicies) return null;

  const policies = [
    {
      id: "refund",
      icon: FileText,
      title: "Refund Policy",
      content: refundPolicy,
    },
    {
      id: "weather",
      icon: CloudRain,
      title: "Weather / Cancellation",
      content: weatherPolicy,
    },
    {
      id: "conduct",
      icon: Shield,
      title: "Player Conduct & Sportsmanship",
      content: conductPolicy,
    },
    {
      id: "liability",
      icon: AlertTriangle,
      title: "Liability & Waiver",
      content: liabilityPolicy,
    },
    {
      id: "notes",
      icon: StickyNote,
      title: "Additional Notes",
      content: extraNotes,
    },
  ].filter(p => p.content);

  // If we have legacy policiesText but no new policies, show it as a simple section
  if (policies.length === 0 && policiesText) {
    return (
      <section className="py-16 md:py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Policies & Player Info
            </h2>
          </motion.div>
          <Card>
            <CardContent className="p-6 md:p-8">
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {policiesText}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24 px-4 bg-muted/30">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Policies & Player Agreement
          </h2>
          <p className="text-muted-foreground">
            Please review these policies before registering
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-2">
            <CardContent className="p-0">
              <Accordion type="single" collapsible className="w-full">
                {policies.map((policy, index) => (
                  <AccordionItem 
                    key={policy.id} 
                    value={policy.id}
                    className={index === 0 ? "border-t-0" : ""}
                  >
                    <AccordionTrigger className="px-4 md:px-6 py-3 md:py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2 md:gap-3">
                        <policy.icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                        <span className="font-semibold text-foreground text-left text-sm md:text-base">
                          {policy.title}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 md:px-6 pb-4 md:pb-6">
                      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed pl-4 md:pl-8 text-sm md:text-base">
                        {policy.content}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
