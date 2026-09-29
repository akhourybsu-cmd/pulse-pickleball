import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { imageCrop, dragImageCrop } from "@/lib/venues/imageCrop";
import { VenueImagePreview } from "@/components/venue/VenueImagePreview";
import { CommunityBrandMark } from "@/components/community/CommunityBrandMark";
describe("reversible venue image framing", () => {
  it("preserves legacy top focus and safely bounds malformed input", () => {
    expect(imageCrop(null, true)).toEqual({ x: 50, y: 0, zoom: 1 });
    expect(imageCrop({ x: -5, y: 200, zoom: 10 })).toEqual({
      x: 0,
      y: 100,
      zoom: 3,
    });
    expect(imageCrop({ x: NaN, y: "90", zoom: Infinity })).toEqual({
      x: 50,
      y: 50,
      zoom: 1,
    });
  });
  it("moves the visible image with a drag and stops at its edges", () => {
    const start = { x: 50, y: 50, zoom: 1 };
    const frame = { width: 100, height: 100 },
      natural = { width: 200, height: 100 };
    expect(dragImageCrop(start, 25, 15, frame, natural, "cover")).toEqual({
      x: 25,
      y: 50,
      zoom: 1,
    });
    expect(dragImageCrop(start, 500, 0, frame, natural, "cover").x).toBe(0);
    expect(
      dragImageCrop({ ...start, zoom: 2 }, 30, 0, frame, natural, "cover").x,
    ).toBe(40);
  });
  it("uses the same saved focus and zoom on both preview sizes without changing the source URL", () => {
    const html = renderToStaticMarkup(
      <VenueImagePreview
        identity={{
          name: "Rally House",
          logoUrl: "/logo.png",
          logoCrop: { x: 25, y: 35, zoom: 1.5 },
        }}
        cover={{ src: "/cover.png", crop: { x: 70, y: 20, zoom: 2 } }}
      />,
    );
    expect(html.match(/object-position:70% 20%/g)).toHaveLength(2);
    expect(html.match(/transform:scale\(2\)/g)).toHaveLength(2);
    expect(html.match(/object-position:25% 35%/g)).toHaveLength(2);
    expect(html).toContain('src="/cover.png"');
    expect(html).toContain('src="/logo.png"');
  });
  it("prefers venue identity and supplies readable initials for ordinary communities", () => {
    const html = renderToStaticMarkup(
      <CommunityBrandMark
        group={{
          name: "Club",
          icon_url: "/old.png",
          venue: {
            name: "Venue",
            logo_url: "/venue.png",
            logo_crop: { x: 20, y: 80, zoom: 2 },
            logo_background_color: "#112233",
          } as any,
        }}
      />,
    );
    expect(html).toContain("/venue.png");
    expect(html).not.toContain("/old.png");
    expect(html).toContain("object-position:20% 80%");
    expect(html).toContain("background-color:#112233");
    const fallback = renderToStaticMarkup(
      <CommunityBrandMark
        group={{ name: "Tuesday Players", icon_url: null }}
      />,
    );
    expect(fallback).toContain("TP");
    expect(fallback).toContain("hsl(var(--foreground))");
  });
});
