import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it } from "vitest";
import { PublicHomepage } from "@/components/homepage/PublicHomepage";
import { HomepageNav } from "@/components/homepage/HomepageNav";
import { MARKETING_DESCRIPTION, MARKETING_TITLE, marketingFAQs, marketingLinks, SIGNUP_URL } from "@/components/homepage/marketingContent";

const render = (element: React.ReactElement) => renderToStaticMarkup(<HelmetProvider><StaticRouter location="/">{element}</StaticRouter></HelmetProvider>);

describe("public homepage", () => {
  it("has one primary heading, a main landmark, and a keyboard skip link", () => {
    const html = render(<PublicHomepage />);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('id="main-content" tabindex="-1"');
    expect(html).toContain('href="#main-content"');
  });
  it("gives each public navigation item a real section", () => {
    const html = render(<PublicHomepage />);
    for (const link of marketingLinks) expect(html).toContain(`id="${link.href.split("#")[1]}"`);
    expect(new Set(marketingLinks.map(link => link.href)).size).toBe(marketingLinks.length);
  });
  it("opens account creation in signup mode, not the default sign-in form", () => {
    const html = render(<PublicHomepage />);
    expect(new URL(SIGNUP_URL, "https://pulsepb.com").searchParams.get("mode")).toBe("signup");
    const ctas = html.match(/<a[^>]*href="\/auth\?mode=signup"[^>]*>/g) ?? [];
    expect(ctas.length).toBeGreaterThanOrEqual(5);
    expect(html).toContain('href="/auth"');
  });
  it("does not send anonymous discovery navigation straight into protected routes", () => {
    const html = render(<PublicHomepage />);
    expect(html).not.toMatch(/href="\/(?:play|events\/browse|player\/community)"/);
  });
  it("clearly labels all product illustrations as examples", () => {
    const html = render(<PublicHomepage />);
    const figures = html.match(/<figure[\s\S]*?<\/figure>/g) ?? [];
    expect(figures).toHaveLength(3);
    for (const figure of figures) expect(figure).toMatch(/<figcaption>Illustrative[\s\S]*Sample/i);
  });
  it("explains pricing, devices, ratings, and existing groups with native accessible disclosures", () => {
    const html = render(<PublicHomepage />);
    expect(html.match(/<summary>/g)).toHaveLength(marketingFAQs.length);
    for (const { question } of marketingFAQs) expect(html).toContain(question);
    expect(html).toContain("Eligible, verified");
    expect(html).toContain("not an official DUPR rating");
    expect(html).not.toMatch(/divisions|under 30 seconds|watch.{0,10}climb/i);
  });
  it("keeps public chrome useful on the existing signed-in players landing page", () => {
    const html = render(<HomepageNav isLoggedIn />);
    expect(html).toContain('href="/player/dashboard"');
    expect(html).toContain("Dashboard");
    expect(html).not.toContain('href="/auth"');
  });
  it("keeps static share/search metadata aligned with the rendered homepage", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    expect(html).toContain(`<title>${MARKETING_TITLE}</title>`);
    expect(html.match(new RegExp(MARKETING_DESCRIPTION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))).toHaveLength(3);
  });
});
