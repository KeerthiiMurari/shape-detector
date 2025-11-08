class ShapeDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
  }

  // Convert image to grayscale
  private toGray(imageData: ImageData): Uint8ClampedArray {
    const gray = new Uint8ClampedArray(imageData.width * imageData.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[i / 4] = avg;
    }
    return gray;
  }

  // Simple Sobel edge detection
  private sobel(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    const edges = new Uint8ClampedArray(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sumX = 0, sumY = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = gray[(y + ky) * width + (x + kx)];
            const idx = (ky + 1) * 3 + (kx + 1);
            sumX += gx[idx] * pixel;
            sumY += gy[idx] * pixel;
          }
        }
        const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
        edges[y * width + x] = magnitude > 100 ? 255 : 0; // threshold
      }
    }
    return edges;
  }

  // Detect and classify simple shapes
  async detectShapes(imageData: ImageData): Promise<void> {
    const gray = this.toGray(imageData);
    const edges = this.sobel(gray, imageData.width, imageData.height);

    const shapes: { cx: number; cy: number; type: string }[] = [];

    // Very basic blob-based detection
    const visited = new Set<number>();
    const width = imageData.width;
    const height = imageData.height;

    const getIdx = (x: number, y: number) => y * width + x;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = getIdx(x, y);
        if (edges[idx] === 255 && !visited.has(idx)) {
          // BFS to get connected points
          const queue = [[x, y]];
          const points: [number, number][] = [];
          while (queue.length) {
            const [cx, cy] = queue.pop()!;
            const i = getIdx(cx, cy);
            if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
            if (edges[i] === 0 || visited.has(i)) continue;

            visited.add(i);
            points.push([cx, cy]);

            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++)
                queue.push([cx + dx, cy + dy]);
          }

          // Rough centroid
          const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
          const cy = points.reduce((a, p) => a + p[1], 0) / points.length;

          // Classify shape (basic heuristic)
          let type = "Unknown";
          const size = points.length;

          if (size < 50) continue; // ignore noise
          if (size < 300) type = "Triangle";
          else if (size < 600) type = "Rectangle";
          else if (size > 600) type = "Circle";

          shapes.push({ cx, cy, type });
        }
      }
    }

    // Draw results
    const ctx = this.ctx;
    ctx.putImageData(imageData, 0, 0);
    ctx.font = "16px Arial";
    ctx.fillStyle = "red";
    shapes.forEach((s) => {
      ctx.fillText(s.type, s.cx, s.cy);
    });

    console.log("Detected shapes:", shapes);
  }
}

// Usage
window.onload = () => {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const input = document.getElementById("fileInput") as HTMLInputElement;
  const ctx = canvas.getContext("2d")!;
  const detector = new ShapeDetector(canvas);

  input.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);
      await detector.detectShapes(imgData);
    };
    img.src = URL.createObjectURL(file);
  });
};

