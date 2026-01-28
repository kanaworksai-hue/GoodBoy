import React, { useRef, useEffect } from 'react';

interface BloomingFlowerProps {
  mousePos: { x: number; y: number };
}

// --- Configuration ---
const LAYERS_COUNT = 24;      // Increased for density (Dahlia look)
const PETALS_BASE = 8;        // More petals at the center
const PETALS_INCREMENT = 1.2; // Density increases outwards
const MAX_RADIUS = 450;
const BLOOM_SPEED = 1.2;      // Snappy flip
const BLOOM_STAGGER = 0.05;   // Fast sequence

// View & Perspective
const VIEW_TILT = 0.3;  // 3/4 Side view
const Y_OFFSET = 50;   

// Ripple Physics ("Stone in Lake")
const RIPPLE_RADIUS = 250;
const RIPPLE_STRENGTH = 50; 
const RIPPLE_FREQ = 0.06;   
const RIPPLE_SPEED = 6.0;

const BloomingFlower: React.FC<BloomingFlowerProps> = ({ mousePos }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // --- Easing for "Card Flip" effect ---
    const easeOutBack = (x: number): number => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    };

    // --- Color Palette (Blue Dahlia) ---
    const getLayerColor = (layerIndex: number, totalLayers: number) => {
      const t = layerIndex / totalLayers;
      
      // Image Analysis:
      // Center: Glowing Pale Pink/White
      // Mid: Periwinkle / Lavender
      // Outer: Deep Royal Blue / Violet
      
      // Hue: 280 (Purple) -> 230 (Deep Blue)
      const hue = 260 - (t * 30); 
      
      // Saturation: Low at center (white), high at mid/edges
      // Center (t=0): 10%, Edge (t=1): 80%
      const sat = 10 + (t * 70);
      
      // Lightness: High at center (glowing), Dark at edges (shadows)
      // Center: 95%, Edge: 45%
      const light = 95 - (t * 50);
      
      return `hsl(${hue}, ${sat}%, ${light}%)`;
    };

    // --- 3D Projection Helpers ---
    const project = (x: number, y: number, z: number, cx: number, cy: number) => {
      // Tilt logic: Rotate around X axis
      const rad = 1.2 - VIEW_TILT; 
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const rx = x;
      const ry = y * cos - z * sin;
      const rz = y * sin + z * cos;

      const screenX = cx + rx;
      const screenY = cy - ry + Y_OFFSET; 
      
      return { x: screenX, y: screenY, z: rz };
    };

    // --- Distortion Logic ---
    const distort = (px: number, py: number, time: number) => {
      const dx = px - mousePos.x;
      const dy = py - mousePos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > RIPPLE_RADIUS) return { x: px, y: py };

      // Stone in lake effect
      const falloff = Math.pow(1 - dist / RIPPLE_RADIUS, 2.5);
      const wavePhase = dist * RIPPLE_FREQ - time * RIPPLE_SPEED;
      // Sharper wave peaks
      const wave = Math.sin(wavePhase);
      const waveOffset = wave * RIPPLE_STRENGTH * falloff;

      const dirX = dist > 0.1 ? dx / dist : 0;
      const dirY = dist > 0.1 ? dy / dist : 0;

      return {
        x: px + dirX * waveOffset,
        y: py + dirY * waveOffset
      };
    };

    // --- Main Loop ---
    const renderFrame = () => {
      if (!ctx || !canvas) return;
      const time = (Date.now() - startTimeRef.current) / 1000;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      interface DrawItem {
        zDepth: number;
        color: string;
        points: { x: number; y: number }[];
      }
      const drawList: DrawItem[] = [];

      for (let i = 0; i < LAYERS_COUNT; i++) {
        const startT = i * BLOOM_STAGGER;
        const pRaw = (time - startT) * BLOOM_SPEED;
        const pClamped = Math.min(Math.max(pRaw, 0), 1);
        
        // Render all layers even if pRaw < 0 to show the "bud" before it flips
        // But clamp animation at 0
        const bloom = easeOutBack(pClamped);

        const layerNorm = i / LAYERS_COUNT; // 0 to 1
        const layerR = (MAX_RADIUS / LAYERS_COUNT) * (i * 0.9 + 1); // Compact layers
        const petalsN = Math.floor(PETALS_BASE + i * PETALS_INCREMENT);
        const color = getLayerColor(i, LAYERS_COUNT);
        
        // Petal Dimensions
        const L = (MAX_RADIUS / LAYERS_COUNT) * 2.2; // Longer petals for dahlia look
        const W = (2 * Math.PI * layerR) / petalsN * 1.1; // Slightly wider to overlap

        // DOME SHAPE LOGIC
        // Inner petals point UP (Pitch ~ PI/2)
        // Middle petals point OUT (Pitch ~ PI/4)
        // Outer petals point DOWN (Pitch ~ 0 or negative)
        // This creates the ball shape.
        const restingPitch = (Math.PI / 2.2) - (layerNorm * (Math.PI / 1.8)); 
        
        // Animation: Start from strict vertical (closed bud) to restingPitch
        const startPitch = Math.PI / 1.8; // All start pointing up/in
        const currentPitch = startPitch - (bloom * (startPitch - restingPitch));

        for (let j = 0; j < petalsN; j++) {
          // Stagger rotation significantly per layer for dense look
          const theta = (j / petalsN) * Math.PI * 2 + (i * 0.3);

          const baseX = Math.cos(theta) * layerR;
          const baseZ = Math.sin(theta) * layerR;
          
          // Dahlia petals curve UP slightly at the base, then OUT
          // We simulate this with just the pitch vector
          const baseY = -layerNorm * 20; // Slight cone base

          const horizLen = L * Math.cos(currentPitch);
          const vertLen = L * Math.sin(currentPitch);

          const tipX = baseX + Math.cos(theta) * horizLen;
          const tipZ = baseZ + Math.sin(theta) * horizLen;
          const tipY = baseY + vertLen;

          // Control Points
          const midX = (baseX + tipX) / 2;
          const midZ = (baseZ + tipZ) / 2;
          const midY = (baseY + tipY) / 2;

          // Width perpendicular vector
          const perpX = -Math.sin(theta) * (W * 0.5);
          const perpZ = Math.cos(theta) * (W * 0.5);

          // Curve logic: Make them slightly cupped
          const cpYOffset = vertLen * 0.3; 

          const cp1X = midX + perpX;
          const cp1Z = midZ + perpZ;
          const cp1Y = midY + cpYOffset;

          const cp2X = midX - perpX;
          const cp2Z = midZ - perpZ;
          const cp2Y = midY + cpYOffset;

          const pBase = project(baseX, baseY, baseZ, cx, cy);
          const pTip = project(tipX, tipY, tipZ, cx, cy);
          const pCp1 = project(cp1X, cp1Y, cp1Z, cx, cy);
          const pCp2 = project(cp2X, cp2Y, cp2Z, cx, cy);

          const avgZ = (pBase.z + pTip.z + pCp1.z + pCp2.z) / 4;
          
          drawList.push({
            zDepth: avgZ,
            color,
            points: [pBase, pCp1, pTip, pCp2]
          });
        }
      }

      drawList.sort((a, b) => a.zDepth - b.zDepth);

      for (const item of drawList) {
        const [rawBase, rawCp1, rawTip, rawCp2] = item.points;

        const dBase = distort(rawBase.x, rawBase.y, time);
        const dCp1 = distort(rawCp1.x, rawCp1.y, time);
        const dTip = distort(rawTip.x, rawTip.y, time);
        const dCp2 = distort(rawCp2.x, rawCp2.y, time);

        ctx.fillStyle = item.color;
        // Lighter, subtle borders for the ethereal look
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; 
        ctx.lineWidth = 0.5;

        ctx.beginPath();
        ctx.moveTo(dBase.x, dBase.y);
        ctx.quadraticCurveTo(dCp1.x, dCp1.y, dTip.x, dTip.y);
        ctx.quadraticCurveTo(dCp2.x, dCp2.y, dBase.x, dBase.y);
        
        ctx.fill();
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [mousePos]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute top-0 left-0 w-full h-full block touch-none"
    />
  );
};

export default BloomingFlower;