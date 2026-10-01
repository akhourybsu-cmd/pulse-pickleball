import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  imageCrop,
  imageCropStyle,
  dragImageCrop,
  type ImageCrop,
} from "@/lib/venues/imageCrop";
export function VenueImagePositionEditor({
  src,
  label,
  kind,
  fit,
  shape,
  backgroundColor,
  value,
  onChange,
  disabled = false,
  saveHint = "Save the venue profile to apply.",
}: {
  src: string;
  label: string;
  kind: "logo" | "cover";
  fit: "contain" | "cover";
  shape?: "circle" | "square";
  backgroundColor?: string;
  value: unknown;
  onChange: (crop: ImageCrop) => void;
  disabled?: boolean;
  saveHint?: string;
}) {
  const id = useId(),
    crop = imageCrop(value);
  const padding =
    kind === "logo" && fit === "contain"
      ? shape === "circle"
        ? 0.15
        : 0.04
      : 0;
  const natural = useRef({ width: 1, height: 1 });
  const drag = useRef<{
    x: number;
    y: number;
    crop: ImageCrop;
    frame: { width: number; height: number };
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 space-y-3 rounded-xl border bg-card p-4"
    >
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      <p id={id + "-hint"} className="text-xs leading-5 text-muted-foreground">
        Drag the image to position it, or use the sliders. Your original image
        stays intact. {saveHint}
      </p>
      <div
        role="group"
        aria-label={label + " preview"}
        aria-describedby={id + "-hint"}
        className={
          "relative touch-none overflow-hidden bg-muted " +
          (kind === "cover"
            ? "aspect-[3/1] w-full rounded-xl"
            : "aspect-square mx-auto w-40 " +
              (shape === "circle" ? "rounded-full" : "rounded-2xl"))
        }
        style={{ cursor: disabled ? "default" : "grab", backgroundColor }}
        onPointerDown={(e) => {
          if (disabled || failed === src) return;
          const r = e.currentTarget.getBoundingClientRect();
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            crop,
            frame: { width: r.width, height: r.height },
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d && !disabled)
            onChange(
              dragImageCrop(
                d.crop,
                e.clientX - d.x,
                e.clientY - d.y,
                d.frame,
                natural.current,
                fit,
                padding,
              ),
            );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        {failed === src ? (
          <p role="alert" className="p-3 text-sm">
            Image could not load. Replace it to adjust its position.
          </p>
        ) : (
          <img
            key={src}
            src={src}
            alt={label + " preview"}
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none"
            style={{
              objectFit: fit,
              ...imageCropStyle(crop),
              padding:
                kind === "logo" && fit === "contain"
                  ? shape === "circle"
                    ? "15%"
                    : "4%"
                  : 0,
            }}
            onLoad={(e) => {
              natural.current = {
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              };
            }}
            onError={() => setFailed(src)}
          />
        )}
      </div>
      {(
        [
          ["x", "Horizontal position", 0, 100, 1],
          ["y", "Vertical position", 0, 100, 1],
          ["zoom", "Zoom", 1, 3, 0.05],
        ] as const
      ).map(([key, text, min, max, step]) => (
        <label
          key={key}
          htmlFor={id + key}
          className="block text-xs font-medium"
        >
          <span className="flex justify-between">
            <span>{text}</span>
            <output>
              {key === "zoom"
                ? crop[key].toFixed(2) + "×"
                : Math.round(crop[key]) + "%"}
            </output>
          </span>
          <input
            id={id + key}
            type="range"
            aria-label={label + " " + text.toLowerCase()}
            min={min}
            max={max}
            step={step}
            value={crop[key]}
            onChange={(e) =>
              onChange({ ...crop, [key]: Number(e.target.value) })
            }
            className="mt-2 h-6 w-full accent-[hsl(var(--primary))]"
          />
        </label>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange({ x: 50, y: 50, zoom: 1 })}
      >
        Reset position
      </Button>
    </fieldset>
  );
}
