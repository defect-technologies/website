const MAX_DENSITY = 2;

/** Sizes the backing store to the canvas's on-screen box and returns a cleared context. */
export function fitToDisplay(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const density = Math.min(window.devicePixelRatio || 1, MAX_DENSITY);
  const width = Math.max(1, Math.round(canvas.clientWidth * density));
  const height = Math.max(1, Math.round(canvas.clientHeight * density));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, width, height);
  return context;
}

export function pointIn(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const box = canvas.getBoundingClientRect();
  return {
    x: ((clientX - box.left) / box.width) * canvas.width,
    y: ((clientY - box.top) / box.height) * canvas.height,
  };
}
