import React, { useRef, useEffect } from 'react';

interface FishBowlProps {
  mousePos: { x: number; y: number };
  wave: number;           // Incrementing this respawns the fish
  medalCount: number;     // Determines available colors
  onCatch: () => void;    // Callback when a fish is caught
  onAllCaught: () => void;// Callback when bowl is empty
}

// --- Configuration ---
// BOWL_RADIUS is now calculated dynamically
const FISH_COUNT = 8;
const BASE_FISH_SPEED = 0.6;       
const RIPPLE_RADIUS_RATIO = 0.7; // Ripple size relative to bowl radius
const RIPPLE_STRENGTH = 80;   
const RIPPLE_FREQ = 0.12;     
const RIPPLE_SPEED = 8.0;     
const AMBIENT_WAVE_STR = 5;   
const CATCH_RADIUS = 50;      

// --- Colors Palette (Unlock order) ---
const UNLOCKABLE_COLORS = [
  { body: '#FF7F50', fin: '#FF4500' }, // Level 0: Coral (Orange)
  { body: '#F0F8FF', fin: '#87CEFA' }, // Level 1: Ice Blue / White
  { body: '#FFD700', fin: '#DAA520' }, // Level 2: Gold
  { body: '#333333', fin: '#DC143C' }, // Level 3: Black & Red
  { body: '#DA70D6', fin: '#8A2BE2' }, // Level 4: Orchid / Purple
];

// --- Types ---
interface Fish {
  id: number;
  x: number;
  y: number;
  angle: number; 
  speed: number;
  size: number;
  colorBody: string;
  colorFin: string;
  turnSpeed: number;
  tailOffset: number;
  targetAngle?: number;
  dead?: boolean;
}

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  wobblePhase: number;
}

const FishBowl: React.FC<FishBowlProps> = ({ mousePos, wave, medalCount, onCatch, onAllCaught }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const fishRef = useRef<Fish[]>([]);
  const bubblesRef = useRef<Bubble[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const isLevelClearedRef = useRef<boolean>(false);
  const lastCatchTimeRef = useRef<number>(Date.now()); 
  
  // Responsive State
  const radiusRef = useRef<number>(350);

  // --- Initialize / Respawn Fish on Wave Change ---
  useEffect(() => {
    // Initial radius guess
    const initialRadius = Math.min(window.innerWidth, window.innerHeight) * 0.45;
    
    // Determine how many color variants are unlocked (Base 1 + Medals, capped at 5)
    const availableColorsCount = Math.min(UNLOCKABLE_COLORS.length, 1 + medalCount);
    const activePalette = UNLOCKABLE_COLORS.slice(0, availableColorsCount);

    const newFish: Fish[] = [];
    for (let i = 0; i < FISH_COUNT; i++) {
      const colorSet = activePalette[i % activePalette.length];
      newFish.push({
        id: Date.now() + i,
        x: (Math.random() - 0.5) * initialRadius * 1.2,
        y: (Math.random() - 0.5) * initialRadius * 1.2,
        angle: Math.random() * Math.PI * 2,
        speed: BASE_FISH_SPEED * (0.8 + Math.random() * 0.4),
        size: 0.8 + Math.random() * 0.4,
        colorBody: colorSet.body,
        colorFin: colorSet.fin,
        turnSpeed: 0.01 + Math.random() * 0.02,
        tailOffset: Math.random() * 100,
      });
    }
    fishRef.current = newFish;
    isLevelClearedRef.current = false;
    lastCatchTimeRef.current = Date.now(); 
  }, [wave, medalCount]); 

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Dynamic Radius: 45% of the smallest screen dimension
      radiusRef.current = Math.min(canvas.width, canvas.height) * 0.42;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // --- Physics & Logic ---
    const getDistortion = (px: number, py: number, time: number, radius: number) => {
      const ambientX = Math.sin(py * 0.008 + time * 0.8) * AMBIENT_WAVE_STR;
      const ambientY = Math.cos(px * 0.008 + time * 0.8) * AMBIENT_WAVE_STR;

      let tx = px + ambientX;
      let ty = py + ambientY;

      const dx = px - mousePos.x;
      const dy = py - mousePos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const rippleR = radius * RIPPLE_RADIUS_RATIO;

      if (dist < rippleR) {
        const falloff = Math.pow(1 - dist / rippleR, 3); 
        const wave = Math.sin(dist * RIPPLE_FREQ - time * RIPPLE_SPEED);
        const displacement = wave * RIPPLE_STRENGTH * falloff;

        const dirX = dist > 0.1 ? dx / dist : 0;
        const dirY = dist > 0.1 ? dy / dist : 0;

        tx += dirX * displacement;
        ty += dirY * displacement;
      }

      return { x: tx, y: ty };
    };

    const drawCaustics = (ctx: CanvasRenderingContext2D, cx: number, cy: number, time: number, radius: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.95, 0, Math.PI * 2);
      ctx.clip(); 

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      
      const step = radius * 0.12; // Dynamic step size
      
      // Layer 1
      ctx.beginPath();
      for (let y = -radius; y < radius; y += step) {
        for (let x = -radius; x < radius; x += 15) {
          const ox = cx + x;
          const oy = cy + y + Math.sin(x * 0.03 + time) * 20; 
          const d = getDistortion(ox, oy, time, radius);
          if (x === -radius) ctx.moveTo(d.x, d.y);
          else ctx.lineTo(d.x, d.y);
        }
      }
      ctx.stroke();

      // Layer 2
      ctx.beginPath();
      for (let x = -radius; x < radius; x += step) {
        for (let y = -radius; y < radius; y += 15) {
          const ox = cx + x + Math.sin(y * 0.03 + time * 1.3) * 20;
          const oy = cy + y;
          const d = getDistortion(ox, oy, time, radius);
          if (y === -radius) ctx.moveTo(d.x, d.y);
          else ctx.lineTo(d.x, d.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    };

    const updateAndDrawBubbles = (ctx: CanvasRenderingContext2D, cx: number, cy: number, time: number, radius: number) => {
      if (Math.random() < 0.03) {
        bubblesRef.current.push({
          id: Math.random(),
          x: (Math.random() - 0.5) * radius * 1.5,
          y: radius * 0.8, 
          size: 2 + Math.random() * 4,
          speed: 1 + Math.random() * 2,
          wobblePhase: Math.random() * Math.PI * 2
        });
      }

      bubblesRef.current = bubblesRef.current.filter(b => b.y > -radius);
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;

      bubblesRef.current.forEach(b => {
        b.y -= b.speed;
        const wobble = Math.sin(time * 3 + b.wobblePhase) * 5;
        const screenX = cx + b.x + wobble;
        const screenY = cy + b.y;
        const d = getDistortion(screenX, screenY, time, radius);

        ctx.beginPath();
        ctx.arc(d.x, d.y, b.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(d.x - b.size*0.3, d.y - b.size*0.3, b.size*0.2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; 
      });
    };

    const updateFish = (fish: Fish, cx: number, cy: number, time: number, radius: number) => {
      fish.x += Math.cos(fish.angle) * fish.speed;
      fish.y += Math.sin(fish.angle) * fish.speed;

      const dist = Math.sqrt(fish.x * fish.x + fish.y * fish.y);
      const boundary = radius - 60; 

      if (dist > boundary) {
        const angleToCenter = Math.atan2(-fish.y, -fish.x);
        let diff = angleToCenter - fish.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        // Turn faster if far out of bounds (resize event)
        const urgency = dist > radius ? 4 : 2;
        fish.angle += Math.sign(diff) * fish.turnSpeed * urgency;
      } else {
        if (Math.random() < 0.01) {
            fish.targetAngle = fish.angle + (Math.random() - 0.5) * 2;
        }
        if (fish.targetAngle !== undefined) {
             let diff = fish.targetAngle - fish.angle;
             while (diff < -Math.PI) diff += Math.PI * 2;
             while (diff > Math.PI) diff -= Math.PI * 2;
             if (Math.abs(diff) < 0.05) fish.targetAngle = undefined;
             else fish.angle += Math.sign(diff) * fish.turnSpeed;
        }
      }

      const screenX = cx + fish.x;
      const screenY = cy + fish.y;
      const distToMouse = Math.sqrt(
        Math.pow(screenX - mousePos.x, 2) + Math.pow(screenY - mousePos.y, 2)
      );

      if (distToMouse < CATCH_RADIUS && !fish.dead) {
        fish.dead = true;
        lastCatchTimeRef.current = Date.now(); 
        onCatch();
      }
    };

    const drawCuteFish = (ctx: CanvasRenderingContext2D, fish: Fish, time: number, cx: number, cy: number, radius: number) => {
      const screenX = cx + fish.x;
      const screenY = cy + fish.y;
      
      const cos = Math.cos(fish.angle);
      const sin = Math.sin(fish.angle);
      
      // Scaling factor for fish based on radius, to keep them proportional-ish but not too tiny
      const scale = 0.6 + (radius / 600); 

      const t = (lx: number, ly: number) => {
        const rx = (lx * cos - ly * sin) * fish.size * scale;
        const ry = (lx * sin + ly * cos) * fish.size * scale;
        const sx = screenX + rx;
        const sy = screenY + ry;
        return getDistortion(sx, sy, time, radius);
      };

      const bodyLen = 25;
      const bodyWidth = 15;

      // Body
      ctx.fillStyle = fish.colorBody;
      const pNose = t(bodyLen, 0);
      const pTailBase = t(-bodyLen, 0);
      const pTop = t(0, -bodyWidth);
      const pBottom = t(0, bodyWidth);
      const pTopFront = t(bodyLen * 0.6, -bodyWidth * 0.7);
      const pTopBack = t(-bodyLen * 0.6, -bodyWidth * 0.7);
      const pBotFront = t(bodyLen * 0.6, bodyWidth * 0.7);
      const pBotBack = t(-bodyLen * 0.6, bodyWidth * 0.7);

      ctx.beginPath();
      ctx.moveTo(pNose.x, pNose.y);
      ctx.bezierCurveTo(pTopFront.x, pTopFront.y, pTop.x, pTop.y, pTopBack.x, pTopBack.y);
      ctx.lineTo(pTailBase.x, pTailBase.y);
      ctx.bezierCurveTo(pBotBack.x, pBotBack.y, pBottom.x, pBottom.y, pBotFront.x, pBotFront.y);
      ctx.closePath();
      ctx.fill();

      // Tail
      const wiggle = Math.sin(time * 6 + fish.tailOffset) * 10;
      const tailLen = 20;
      const tailWid = 15;

      const pTailTipTop = t(-bodyLen - tailLen, -tailWid + wiggle);
      const pTailTipBot = t(-bodyLen - tailLen, tailWid + wiggle);
      const pTailMid = t(-bodyLen - tailLen * 0.8, wiggle * 0.5);

      ctx.fillStyle = fish.colorFin;
      ctx.beginPath();
      ctx.moveTo(pTailBase.x, pTailBase.y);
      ctx.quadraticCurveTo(pTailMid.x, pTailMid.y, pTailTipTop.x, pTailTipTop.y);
      ctx.lineTo(pTailTipBot.x, pTailTipBot.y);
      ctx.quadraticCurveTo(pTailMid.x, pTailMid.y, pTailBase.x, pTailBase.y);
      ctx.fill();

      // Fins
      const finWiggle = Math.cos(time * 8 + fish.tailOffset) * 5;
      const pFinRoot = t(5, bodyWidth * 0.8);
      const pFinTip = t(0, bodyWidth * 0.8 + 12 + finWiggle);
      const pFinBack = t(10, bodyWidth * 0.8 + 8 + finWiggle); 

      ctx.beginPath();
      ctx.moveTo(pFinRoot.x, pFinRoot.y);
      ctx.lineTo(pFinTip.x, pFinTip.y);
      ctx.lineTo(pFinBack.x, pFinBack.y);
      ctx.fill();
      
      const pFinRootL = t(5, -bodyWidth * 0.8);
      const pFinTipL = t(0, -bodyWidth * 0.8 - 12 - finWiggle); 
      const pFinBackL = t(10, -bodyWidth * 0.8 - 8 - finWiggle); 
      
      ctx.beginPath();
      ctx.moveTo(pFinRootL.x, pFinRootL.y);
      ctx.lineTo(pFinTipL.x, pFinTipL.y);
      ctx.lineTo(pFinBackL.x, pFinBackL.y);
      ctx.fill();

      // Eyes
      const eyeX = 12;
      const eyeY = -6;
      const eyeSize = 6 * scale;
      
      const pEye = t(eyeX, eyeY);
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(pEye.x, pEye.y, eyeSize, 0, Math.PI * 2);
      ctx.fill();
      
      const pPupil = t(eyeX + 2, eyeY);
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(pPupil.x, pPupil.y, (eyeSize/2.5), 0, Math.PI * 2);
      ctx.fill();

      const pEye2 = t(eyeX, -eyeY);
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(pEye2.x, pEye2.y, eyeSize, 0, Math.PI * 2);
      ctx.fill();
      
      const pPupil2 = t(eyeX + 2, -eyeY); 
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(pPupil2.x, pPupil2.y, (eyeSize/2.5), 0, Math.PI * 2);
      ctx.fill();
    };

    // --- Main Render Loop ---
    const render = () => {
      if (!ctx || !canvas) return;
      const now = Date.now();
      const time = (now - startTimeRef.current) / 1000;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = radiusRef.current;

      // --- Spawn Fish if Idle (Every 2 seconds), Max 15 Fish ---
      if (now - lastCatchTimeRef.current > 2000 && fishRef.current.length < 15) {
        const availableColorsCount = Math.min(UNLOCKABLE_COLORS.length, 1 + medalCount);
        const activePalette = UNLOCKABLE_COLORS.slice(0, availableColorsCount);
        const colorSet = activePalette[Math.floor(Math.random() * activePalette.length)];

        fishRef.current.push({
          id: now + Math.random(),
          x: (Math.random() - 0.5) * radius * 1.0, 
          y: (Math.random() - 0.5) * radius * 1.0,
          angle: Math.random() * Math.PI * 2,
          speed: BASE_FISH_SPEED * (0.8 + Math.random() * 0.4),
          size: 0.8 + Math.random() * 0.4,
          colorBody: colorSet.body,
          colorFin: colorSet.fin,
          turnSpeed: 0.01 + Math.random() * 0.02,
          tailOffset: Math.random() * 100,
        });
        lastCatchTimeRef.current = now; 
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Water Background
      const gradient = ctx.createRadialGradient(cx, cy - radius * 0.4, radius * 0.1, cx, cy, radius);
      gradient.addColorStop(0, '#E0F7FA');  
      gradient.addColorStop(0.3, '#81D4FA'); 
      gradient.addColorStop(0.7, '#29B6F6'); 
      gradient.addColorStop(1, '#0277BD');   

      ctx.fillStyle = gradient;
      
      const bowlWobbleX = Math.sin(time * 0.5) * 2;
      const bowlWobbleY = Math.cos(time * 0.6) * 2;
      
      ctx.beginPath();
      ctx.arc(cx + bowlWobbleX, cy + bowlWobbleY, radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // 2. Caustics
      drawCaustics(ctx, cx + bowlWobbleX, cy + bowlWobbleY, time, radius);

      // 3. Bubbles
      updateAndDrawBubbles(ctx, cx, cy, time, radius);

      // 4. Fish
      fishRef.current = fishRef.current.filter(f => !f.dead);
      
      // Check for Level Clear
      if (fishRef.current.length === 0 && !isLevelClearedRef.current) {
         isLevelClearedRef.current = true;
         onAllCaught();
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      fishRef.current.forEach(fish => {
        updateFish(fish, cx, cy, time, radius);
        drawCuteFish(ctx, fish, time, cx, cy, radius);
      });
      ctx.restore();

      // 5. Glass Reflections
      ctx.save();
      ctx.translate(bowlWobbleX, bowlWobbleY);
      
      ctx.beginPath();
      ctx.ellipse(cx, cy - radius * 0.6, radius * 0.5, radius * 0.15, 0, Math.PI, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.92, 3.5, 5.5);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 15;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.92, 0.5, 1.5);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.restore();

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [mousePos, medalCount]); 

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute top-0 left-0 w-full h-full block touch-none"
    />
  );
};

export default FishBowl;