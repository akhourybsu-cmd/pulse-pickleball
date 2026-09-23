import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicHomepage } from "@/components/homepage/PublicHomepage";
import { HomepageNav } from "@/components/homepage/HomepageNav";
import { productScreens } from "@/components/homepage/productScreens";
import { MARKETING_DESCRIPTION, MARKETING_TITLE, marketingFAQs, marketingLinks, SIGNUP_URL } from "@/components/homepage/marketingContent";

const render = (element: React.ReactElement) => renderToStaticMarkup(<HelmetProvider><StaticRouter location="/">{element}</StaticRouter></HelmetProvider>);
afterEach(() => vi.unstubAllEnvs());

describe("public homepage", () => {
  it("has one primary heading, a main landmark, and a keyboard skip link", () => {
    const html = render(<PublicHomepage />);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('id="main-content" tabindex="-1"');
    expect(html).toContain('href="#main-content"');
  });
  it("gives each public navigation item a real section or public assessment destination", () => {
    const html = render(<PublicHomepage />);
    for (const link of marketingLinks) {
      if (link.href.startsWith('/skill-assessment')) expect(html).toContain(`href="${link.href}"`);
      else expect(html).toContain(`id="${link.href.split("#")[1]}"`);
    }
    expect(new Set(marketingLinks.map(link => link.href)).size).toBe(marketingLinks.length);
  });
  it("opens account creation in signup mode, not the default sign-in form", () => {
    const html = render(<PublicHomepage />);
    expect(new URL(SIGNUP_URL, "https://pulsepb.com").searchParams.get("mode")).toBe("signup");
    const ctas = html.match(/<a[^>]*href="\/auth\?mode=signup"[^>]*>/g) ?? [];
    expect(ctas.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain('href="/auth"');
  });
  it('makes the enabled assessment the public hero and navigation action before signup', () => {
    vi.stubEnv('VITE_SKILL_ASSESSMENT', 'on');
    const html = render(<PublicHomepage />);
    expect(html).toContain('Take my free assessment');
    expect(html).toContain('href="/skill-assessment?source=hero"');
    expect(html).toContain('No signup to see results');
    expect(html).toContain('Account to save your analysis');
    expect(html).toContain('href="/pickleball-guide"');
    const nav = render(<HomepageNav />);
    expect(nav).toContain('Free assessment');
  });
  it('keeps the disabled assessment out of the hero and primary navigation', () => {
    vi.stubEnv('VITE_SKILL_ASSESSMENT', 'off');
    const html = render(<PublicHomepage />);
    expect(html).not.toContain('Take my free assessment');
    expect(html).not.toContain('href="/skill-assessment?source=hero"');
    expect(html).toContain('Create your free account');
  });
  it("does not send anonymous discovery navigation straight into protected routes", () => {
    const html = render(<PublicHomepage />);
    expect(html).not.toMatch(/href="\/(?:play|events\/browse|player\/community)"/);
  });
  it("uses real, local screenshots with clear demo labels and accessible controls", () => {
    vi.stubEnv('VITE_SKILL_ASSESSMENT', 'on');
    const html = render(<PublicHomepage />);
    const figures = html.match(/<figure[\s\S]*?<\/figure>/g) ?? [];
    expect(figures).toHaveLength(productScreens.length);
    for (const figure of figures) expect(figure).toContain('<figcaption>Actual PULSE screen · Demo data</figcaption>');
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain('aria-label="Previous feature" disabled=""');
    expect(html).toContain('aria-label="Next feature"');
    expect(html).toContain('aria-label="Choose a feature"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(figures.filter(figure => figure.includes('tabindex="0"'))).toHaveLength(1);
    expect(figures.filter(figure => figure.includes('tabindex="-1"'))).toHaveLength(productScreens.length - 1);
    expect(figures[0]).toContain('loading="eager"');
    expect(figures.slice(1).every(figure => figure.includes('loading="lazy"'))).toBe(true);
    for (const screen of productScreens) {
      expect(html).toContain(`src="${screen.src}"`);
      expect(screen.alt.length).toBeGreaterThan(30);
      const jpeg = readFileSync(new URL(`../../public${screen.src}`, import.meta.url));
      expect(jpeg.subarray(0, 3).toString('hex')).toBe('ffd8ff');
      expect(jpeg.subarray(-2).toString('hex')).toBe('ffd9');
      expect(jpeg.byteLength).toBeLessThan(150_000);
    }
  });
  it("removes the assessment screenshot from the tour when the assessment is disabled", () => {
    vi.stubEnv('VITE_SKILL_ASSESSMENT', 'off');
    const html = render(<PublicHomepage />);
    expect(html).not.toContain('src="/images/product/assessment.jpg"');
    expect(html).toContain('src="/images/product/profile.jpg"');
    expect(html).toContain('1 of 3: Your PULSE');
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
