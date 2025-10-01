import html2canvas from "html2canvas";

export const downloadCardAsImage = async (
  element: HTMLElement,
  filename: string
): Promise<void> => {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: null,
      logging: false,
    });

    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error("Failed to create image");
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error("Failed to generate image");
  }
};
