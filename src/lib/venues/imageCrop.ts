import type { CSSProperties } from "react";
export interface ImageCrop {
  x: number;
  y: number;
  zoom: number;
}
export const DEFAULT_IMAGE_CROP: ImageCrop = { x: 50, y: 50, zoom: 1 };
export function imageCrop(value?: unknown, top = false): ImageCrop {
  const input =
    value && typeof value === "object" ? (value as Partial<ImageCrop>) : {};
  const finite = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.min(max, Math.max(min, v))
      : fallback;
  return {
    x: finite(input.x, 50, 0, 100),
    y: finite(input.y, top ? 0 : 50, 0, 100),
    zoom: finite(input.zoom, 1, 1, 3),
  };
}
export function imageCropStyle(value?: unknown, top = false): CSSProperties {
  const { x, y, zoom } = imageCrop(value, top);
  return {
    objectPosition: `${x}% ${y}%`,
    transform: `scale(${zoom})`,
    transformOrigin: `${x}% ${y}%`,
  };
}
/** Move the rendered image with the pointer, accounting for its fitted overflow. */
export function dragImageCrop(
  start: ImageCrop,
  dx: number,
  dy: number,
  frame: { width: number; height: number },
  natural: { width: number; height: number },
  fit: "cover" | "contain",
  paddingFraction = 0,
): ImageCrop {
  const padX = frame.width * paddingFraction;
  const padY = frame.height * paddingFraction;
  const width = frame.width - 2 * padX,
    height = frame.height - 2 * padY;
  const ratio =
    fit === "cover"
      ? Math.max(width / natural.width, height / natural.height)
      : Math.min(width / natural.width, height / natural.height);
  const overflowX =
      (natural.width * ratio + 2 * padX) * start.zoom - frame.width,
    overflowY = (natural.height * ratio + 2 * padY) * start.zoom - frame.height;
  return imageCrop({
    x: Math.abs(overflowX) > 1 ? start.x - (dx / overflowX) * 100 : start.x,
    y: Math.abs(overflowY) > 1 ? start.y - (dy / overflowY) * 100 : start.y,
    zoom: start.zoom,
  });
}
