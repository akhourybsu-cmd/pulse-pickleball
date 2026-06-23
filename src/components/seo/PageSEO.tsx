import { Helmet } from "react-helmet-async";

const SITE_URL = "https://pulsepb.com";

interface PageSEOProps {
  title: string;
  description: string;
  path: string;
  /** Optional JSON-LD object(s) to include on the page. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  ogType?: "website" | "article";
}

/**
 * Per-route head tags. Sets a unique title, description, self-referencing
 * canonical + og:url, and matching og:title / og:description. Optionally
 * adds page-scoped JSON-LD (FAQPage, Article, etc.).
 */
export function PageSEO({
  title,
  description,
  path,
  jsonLd,
  ogType = "website",
}: PageSEOProps) {
  const url = `${SITE_URL}${path}`;
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
