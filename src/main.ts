import cv from "@techstark/opencv-js";

// Wait until OpenCV is ready
cv['onRuntimeInitialized'] = () => {
  const inputElement = document.getElementById("fileInput") as HTMLInputElement;
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");

  inputElement.addEventListener("change", (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      const src = cv.imread(canvas);
      const gray = new cv.Mat();
      const edges = new cv.Mat();
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.Canny(gray, edges, 100, 200);
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      for (let i = 0; i < contours.size(); ++i) {
        const cnt = contours.get(i);
        const perimeter = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.04 * perimeter, true);

        let shape = "";
        if (approx.rows === 3) shape = "Triangle";
        else if (approx.rows === 4) shape = "Rectangle";
        else if (approx.rows > 4) shape = "Circle";
        else shape = "Unknown";

        const moments = cv.moments(cnt);
        const cx = Math.round(moments.m10 / moments.m00);
        const cy = Math.round(moments.m01 / moments.m00);

        cv.putText(
          src,
          shape,
          new cv.Point(cx - 20, cy),
          cv.FONT_HERSHEY_SIMPLEX,
          0.6,
          new cv.Scalar(255, 0, 0, 255),
          2
        );

        cnt.delete();
        approx.delete();
      }

      cv.imshow("canvas", src);

      src.delete(); gray.delete(); edges.delete();
      contours.delete(); hierarchy.delete();
    };

    img.src = URL.createObjectURL(file);
  });
};
