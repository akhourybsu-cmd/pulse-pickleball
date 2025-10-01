import { toPng } from "html-to-image";

export const downloadCardAsImage = async (
  element: HTMLElement,
  filename: string
): Promise<void> => {
  try {
    const dataUrl = await toPng(element, {
      quality: 1,
      pixelRatio: 2,
    });

    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error("Failed to generate image");
  }
};
