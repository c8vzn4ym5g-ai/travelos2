"use client";

import { heicJpegFilename, isHeicPhoto } from "./moments.ts";

export const maxUploadBytes = 4_500_000;
export const displayMaxEdge = 1600;
export const displayJpegQuality = 0.72;

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
        1500,
        "Photo preparation timed out. Try a smaller JPG photo.",
      );
      return {
        cleanup: () => bitmap.close(),
        height: bitmap.height,
        source: bitmap,
        width: bitmap.width,
      };
    } catch {
      // Fall through to Image() for JPEGs that bitmap cannot read.
    }
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = imageUrl;
    await waitWithTimeout(image.decode(), 1500, "Photo preparation timed out. Try a smaller JPG photo.");
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
  return renderFileAsJpeg(file, displayMaxEdge, displayJpegQuality);
}

export async function prepareDisplayPhoto(file: File) {
  if (isHeicPhoto(file) || file.type === "image/jpeg") {
    // iPhone "Choose Photos" converts HEIC to JPEG in the picker. Skip canvas
    // for both so dumps POST the original File immediately. Same path as the
    // 41-photos-in-8s dump; the server already accepts JPEG and HEIC.
    return file;
  }

  try {
    let display = await convertPhonePhotoToJpeg(file);
    if (display.size > maxUploadBytes) {
      display = await renderFileAsJpeg(display, 1280, 0.65);
    }
    return display;
  } catch {
    return file;
  }
}

export function shouldKeepOriginal(original: File, display: File) {
  return original !== display && (isHeicPhoto(original) || original.size !== display.size || original.name !== display.name);
}

export async function createTinyPreviewUrl(file: File) {
  if (isHeicPhoto(file) || !file.type.startsWith("image/")) {
    return null;
  }

  try {
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
      return null;
    }

    const bitmap = await createImageBitmap(file, {
      resizeHeight: 240,
      resizeQuality: "low",
    });

    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context || typeof URL.createObjectURL !== "function") {
        return null;
      }

      context.drawImage(bitmap, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.6));
      return blob ? URL.createObjectURL(blob) : null;
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

export async function preparePhotoForUpload(file: File) {
  const original = file;
  const display = await prepareDisplayPhoto(file);
  return { display, original };
}
