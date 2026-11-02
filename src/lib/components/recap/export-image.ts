/** Renders an inline SVG to a PNG. */
export const svgToPng = async (svg: SVGSVGElement): Promise<Blob> => {
  const width = svg.viewBox.baseVal.width;
  const height = svg.viewBox.baseVal.height;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.removeAttribute('class');

  const markup = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(
    new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }),
  );

  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not render the image'));
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available');
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) throw new Error('Could not encode the image');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
};

/** Whether the browser can hand a PNG to the system share sheet. */
export const canShareImages = () => {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;
  try {
    return navigator.canShare({
      files: [new File([''], 'test.png', { type: 'image/png' })],
    });
  } catch {
    return false;
  }
};

export const shareBlob = async (
  blob: Blob,
  filename: string,
  title: string,
) => {
  await navigator.share({
    title,
    files: [new File([blob], filename, { type: 'image/png' })],
  });
};

export const canCopyImages = () =>
  typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

export const copyBlob = async (blob: Blob) => {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
};
