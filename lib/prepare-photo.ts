"use client";

import { heicJpegFilename, isHeicPhoto } from "@/lib/family-capture";

const supportedUploadTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
export const maxUploadBytes = 4_500_000;

function waitWithTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function decodePhoto(file: File) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await waitWithTimeout(
        createImageBitmap(file),
        12000,
        "Photo preparation timed out. Try a smaller JPG photo.",
      );
      return {
        cleanup: () => bitmap.close(),
        height: bitmap.height,
        source: bitmap,
        width: bitmap.width,
      };
    } catch {
      // Fall through to Image() so iPhone Safari can still decode HEIC.
    }
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = imageUrl;
    await waitWithTimeout(image.decode(), 12000, "Photo preparation timed out. Try a smaller JPG photo.");
    return {
      cleanup: () => URL.revokeObjectURL(imageUrl),
      height: image.naturalHeight,
      source: image,
      width: image.naturalWidth,
    };
  } catch (error) {
    URL.revokeObjectURL(imageUrl);
    throw error;
  }
}

async function renderFileAsJpeg(file: File, maxSide: number, quality: number) {
  const decoded = await decodePhoto(file);

  try {
    const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not convert this photo to JPEG.");
    }

    context.drawImage(decoded.source, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) {
      throw new Error("Could not convert this photo to JPEG.");
    }

    return new File([blob], heicJpegFilename(file.name), { type: "image/jpeg" });
  } finally {
    decoded.cleanup();
  }
}

async function convertPhonePhotoToJpeg(file: File) {
  try {
    return await renderFileAsJpeg(file, Number.POSITIVE_INFINITY, 0.9);
  } catch {
    throw new Error(
      "Please use JPG, PNG, or WebP. Phone HEIC photos are converted here when this phone can decode them.",
    );
  }
}

async function resizeJpegPngWebp(file: File) {
  if (!supportedUploadTypes.has(file.type)) {
    throw new Error("Please use JPG, PNG, or WebP. Phone HEIC photos need to be converted before upload.");
  }

  if (!file.type.startsWith("image/") || file.size < 1_500_000) {
    return file;
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = imageUrl;
    await waitWithTimeout(image.decode(), 12000, "Photo preparation timed out. Try a smaller JPG photo.");

    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) {
      return file;
    }

    const filename = file.name.replace(/\.[^.]+$/, "") || "trip-photo";
    return new File([blob], `${filename}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export async function preparePhotoForUpload(file: File) {
  const normalized = isHeicPhoto(file) || !supportedUploadTypes.has(file.type) ? await convertPhonePhotoToJpeg(file) : file;
  return resizeJpegPngWebp(normalized);
}
