export function compressAndConvertToBase64(
  file: File,
  maxWidth = 200,
  maxHeight = 200,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get 2D context from canvas"));
          return;
        }

        // Fill background with white to handle transparent PNGs cleanly when saving to JPEG
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Export compressed JPEG string
        let base64String = canvas.toDataURL("image/jpeg", quality);

        // If the base64 string is still over ~30 KB (approx 40,000 chars), further compress it
        if (base64String.length > 40000) {
          base64String = canvas.toDataURL("image/jpeg", 0.5);
        }

        resolve(base64String);
      };
      img.onerror = (err) => reject(err);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
