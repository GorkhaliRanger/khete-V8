export type ValidatedImage = {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
};

type ValidationOptions = {
  width: number;
  height: number;
  maxBytes: number;
  acceptedTypes?: string[];
  label: string;
};

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image could not be read."));
    };
    image.src = url;
  });
}

export async function validateStandardImage(file: File, options: ValidationOptions): Promise<ValidatedImage> {
  const allowed = new Set(options.acceptedTypes ?? [...acceptedTypes]);
  if (!allowed.has(file.type)) {
    const typeLabels: Record<string, string> = {
      "image/jpeg": "JPG",
      "image/png": "PNG",
      "image/webp": "WebP",
    };
    const formats = [...allowed].map((type) => typeLabels[type] ?? type).join(", ");
    throw new Error(`${options.label} must use one of these formats: ${formats}.`);
  }
  if (file.size > options.maxBytes) throw new Error(`${options.label} must be ${Math.round(options.maxBytes / 1024 / 1024)} MB or smaller.`);
  const image = await loadImage(file);
  if (image.naturalWidth !== options.width || image.naturalHeight !== options.height) {
    throw new Error(`${options.label} must be exactly ${options.width} × ${options.height} px. This file is ${image.naturalWidth} × ${image.naturalHeight} px.`);
  }
  return {
    file,
    previewUrl: URL.createObjectURL(file),
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

export function safeStorageName(file: File) {
  const stem = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  return `${Date.now()}-${crypto.randomUUID()}-${stem}.${extension}`;
}
