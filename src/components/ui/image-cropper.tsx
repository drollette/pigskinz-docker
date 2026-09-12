"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "./button";

interface ImageCropperProps {
  imageSrc: string;
  onCrop: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
  cropSize?: number;
}

interface Position {
  x: number;
  y: number;
}

export function ImageCropper({
  imageSrc,
  onCrop,
  onCancel,
  cropSize = 256,
}: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const viewSize = 280; // Size of the visible crop area
  const maskRadius = viewSize / 2 - 20; // Circle mask radius with padding

  // Load and initialize the image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;

      // Calculate initial scale to fit the image
      const minDimension = Math.min(img.width, img.height);
      const initialScale = (maskRadius * 2) / minDimension;
      setScale(Math.max(initialScale, 0.1));

      // Center the image
      setPosition({ x: 0, y: 0 });
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc, maskRadius]);

  // Draw the image on canvas with mask
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imageRef.current;

    if (!canvas || !ctx || !img || !imageLoaded) return;

    // Clear canvas
    ctx.clearRect(0, 0, viewSize, viewSize);

    // Draw image
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const x = (viewSize - scaledWidth) / 2 + position.x;
    const y = (viewSize - scaledHeight) / 2 + position.y;

    ctx.save();
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
    ctx.restore();

    // Draw dark overlay outside circle using path with hole
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.beginPath();
    // Outer rectangle (clockwise)
    ctx.rect(0, 0, viewSize, viewSize);
    // Inner circle (counter-clockwise to create hole)
    ctx.arc(viewSize / 2, viewSize / 2, maskRadius, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.restore();

    // Draw circle border
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(viewSize / 2, viewSize / 2, maskRadius, 0, Math.PI * 2);
    ctx.stroke();
  }, [scale, position, imageLoaded, viewSize, maskRadius]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Handle mouse/touch events for dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Handle zoom
  const handleZoomIn = () => {
    setScale((s) => Math.min(s * 1.2, 5));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(s / 1.2, 0.1));
  };

  const handleReset = () => {
    const img = imageRef.current;
    if (!img) return;

    const minDimension = Math.min(img.width, img.height);
    const initialScale = (maskRadius * 2) / minDimension;
    setScale(Math.max(initialScale, 0.1));
    setPosition({ x: 0, y: 0 });
  };

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.min(Math.max(s * delta, 0.1), 5));
  };

  // Crop the image
  const handleCrop = async () => {
    const img = imageRef.current;
    if (!img) return;

    setIsProcessing(true);

    try {
      // Create an off-screen canvas for the cropped result
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = cropSize;
      outputCanvas.height = cropSize;
      const ctx = outputCanvas.getContext("2d");

      if (!ctx) return;

      // Calculate the visible area in image coordinates
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const imgX = (viewSize - scaledWidth) / 2 + position.x;
      const imgY = (viewSize - scaledHeight) / 2 + position.y;

      // The circle center is at viewSize/2, viewSize/2
      // We need to find the corresponding area in the original image
      const circleLeft = viewSize / 2 - maskRadius;
      const circleTop = viewSize / 2 - maskRadius;
      const circleDiameter = maskRadius * 2;

      // Source coordinates in original image
      const srcX = (circleLeft - imgX) / scale;
      const srcY = (circleTop - imgY) / scale;
      const srcSize = circleDiameter / scale;

      // Draw with circular clip
      ctx.beginPath();
      ctx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, Math.PI * 2);
      ctx.clip();

      // Draw the cropped portion
      ctx.drawImage(
        img,
        srcX,
        srcY,
        srcSize,
        srcSize,
        0,
        0,
        cropSize,
        cropSize
      );

      // Convert to blob
      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            onCrop(blob);
          }
          setIsProcessing(false);
        },
        "image/png",
        0.9
      );
    } catch (error) {
      console.error("Error cropping image:", error);
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={containerRef}
        className="relative touch-none select-none"
        style={{ width: viewSize, height: viewSize }}
      >
        <canvas
          ref={canvasRef}
          width={viewSize}
          height={viewSize}
          className={cn(
            "rounded-lg cursor-move",
            isDragging && "cursor-grabbing"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
        />

        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-base-300 rounded-lg">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleZoomOut}
          disabled={!imageLoaded}
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <input
          type="range"
          min="10"
          max="500"
          value={scale * 100}
          onChange={(e) => setScale(Number(e.target.value) / 100)}
          className="range range-xs w-32"
          disabled={!imageLoaded}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleZoomIn}
          disabled={!imageLoaded}
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={!imageLoaded}
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-sm text-base-content/70">
        Drag to position, scroll or use buttons to zoom
      </p>

      <div className="flex gap-2 w-full">
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          className="flex-1"
          onClick={handleCrop}
          loading={isProcessing}
          disabled={!imageLoaded}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
