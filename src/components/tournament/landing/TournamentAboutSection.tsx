import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface TournamentAboutSectionProps {
  content: string;
  imageUrl?: string | null;
}

export function TournamentAboutSection({ content, imageUrl }: TournamentAboutSectionProps) {
  return (
    <section className="py-16 md:py-24 px-4">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            About This Tournament
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:text-primary/80"
        >
          <ReactMarkdown>{content}</ReactMarkdown>
        </motion.div>

        {imageUrl && (
          <motion.img
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            src={imageUrl}
            alt="Tournament"
            className="mt-8 rounded-xl shadow-lg w-full object-cover max-h-[400px]"
          />
        )}
      </div>
    </section>
  );
}
