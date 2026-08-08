import { useRef, useState, useEffect } from "react";
import { Eraser, Upload } from "lucide-react";

interface Props {
  onCapture: (dataUrl: string) => void;
  disabled?: boolean;
}

export default function SignaturePad({ onCapture, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  // Was a ref before — refs don't trigger re-renders, so the "Use this
  // signature" button's disabled state never reflected whether anything
  // had actually been drawn. Now real state, so the button correctly
  // stays disabled until a stroke exists.
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature((prev) => (prev ? prev : true));
  }

  function endDraw() {
    drawing.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function confirmDrawn() {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    onCapture(canvas.toDataURL("image/png"));
  }

  function handleUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUploadPreview(dataUrl);
      onCapture(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("draw")}
          className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
            mode === "draw" ? "border-black text-black font-medium" : "border-border text-black"
          }`}>
          Draw signature
        </button>
        <button type="button" onClick={() => setMode("upload")}
          className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
            mode === "upload" ? "border-black text-black font-medium" : "border-border text-black"
          }`}>
          Upload image
        </button>
      </div>
      {mode === "draw" ? (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={500}
            height={160}
            className="w-full rounded-lg touch-none bg-white"
            onPointerDown={startDraw}
            onPointerMove={draw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
          />
          <div className="flex gap-2">
            <button type="button" onClick={clearCanvas} disabled={disabled}
              className="flex items-center gap-1.5 text-sm text-black hover:opacity-70 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
              <Eraser className="w-3.5 h-3.5" /> Clear
            </button>
            <button type="button" onClick={confirmDrawn} disabled={disabled || !hasSignature}
              className="ml-auto text-sm px-4 py-1.5 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#2D6A4F]">
              Use this signature
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed border-border px-4 py-6 text-base text-black hover:border-[#2D6A4F]/40 transition-colors">
            <Upload className="w-4 h-4" />
            {uploadPreview ? "Change image" : "Choose a signature image"}
            <input type="file" accept="image/png,image/jpeg" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
          </label>
          {uploadPreview && (
            <img src={uploadPreview} alt="Signature preview" className="h-20 rounded-lg bg-white p-2" />
          )}
        </div>
      )}
    </div>
  );
}