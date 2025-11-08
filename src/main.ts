import "./style.css";

export interface Point {
  x: number;
  y: number;
}

export interface DetectedShape {
  type: "circle" | "triangle" | "rectangle" | "pentagon" | "star";
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  center: Point;
  area: number;
}

export interface DetectionResult {
  shapes: DetectedShape[];
  processingTime: number;
  imageWidth: number;
  imageHeight: number;
}

export class ShapeDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
  }

  // Convert to grayscale
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
        edges[y * width + x] = magnitude > 100 ? 255 : 0;
      }
    }
    return edges;
  }

  // Detect and classify shapes
  async detectShapes(imageData: ImageData): Promise<DetectionResult> {
    const startTime = performance.now();
    const gray = this.toGray(imageData);
    const edges = this.sobel(gray, imageData.width, imageData.height);

    const width = imageData.width;
    const height = imageData.height;
    const visited = new Set<number>();
    const getIdx = (x: number, y: number) => y * width + x;

    const shapes: DetectedShape[] = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = getIdx(x, y);
        if (edges[idx] === 255 && !visited.has(idx)) {
          const queue = [[x, y]];
          const points: [number, number][] = [];

          while (queue.length) {
            const [cx, cy] = queue.pop()!;
            if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
            const i = getIdx(cx, cy);
            if (edges[i] === 0 || visited.has(i)) continue;

            visited.add(i);
            points.push([cx, cy]);

            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++)
                queue.push([cx + dx, cy + dy]);
          }

          if (points.length < 80) continue; // ignore small noise

          const xs = points.map(p => p[0]);
          const ys = points.map(p => p[1]);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
          const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
          const area = (maxX - minX) * (maxY - minY);

          // Heuristic shape classification
          let type: DetectedShape["type"] = "circle";
          if (points.length < 400) type = "triangle";
          else if (points.length < 900) type = "rectangle";
          else if (points.length < 1500) type = "pentagon";
          else type = "circle";

          shapes.push({
            type,
            confidence: 0.7,
            boundingBox: {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            },
            center: { x: cx, y: cy },
            area,
          });
        }
      }
    }

    const processingTime = performance.now() - startTime;
    return {
      shapes,
      processingTime,
      imageWidth: width,
      imageHeight: height,
    };
  }

  async loadImage(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);
        const imageData = this.ctx.getImageData(0, 0, img.width, img.height);
        resolve(imageData);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("originalCanvas") as HTMLCanvasElement;
  const fileInput = document.getElementById("imageInput") as HTMLInputElement;
  const resultsDiv = document.getElementById("results") as HTMLDivElement;

  const detector = new ShapeDetector(canvas);

  fileInput.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    resultsDiv.innerHTML = "<p>Processing...</p>";

    const imageData = await detector.loadImage(file);
    const results = await detector.detectShapes(imageData);

    const { shapes, processingTime } = results;

    let html = `
      <p><strong>Processing Time:</strong> ${processingTime.toFixed(2)}ms</p>
      <p><strong>Shapes Found:</strong> ${shapes.length}</p>
    `;

    if (shapes.length > 0) {
      html += "<h4>Detected Shapes:</h4><ul>";
      shapes.forEach((shape) => {
        html += `
          <li>
            <strong>${shape.type}</strong><br>
            Confidence: ${(shape.confidence * 100).toFixed(1)}%<br>
            Center: (${shape.center.x.toFixed(1)}, ${shape.center.y.toFixed(1)})<br>
            Area: ${shape.area.toFixed(1)}px²
          </li>
        `;
      });
      html += "</ul>";
    } else {
      html += "<p>No shapes detected.</p>";
    }

    resultsDiv.innerHTML = html;
  });
});


