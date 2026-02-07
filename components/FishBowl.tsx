import React, { useRef, useEffect } from 'react';
import { soundManager } from '../utils/SoundManager';

interface FishBowlProps {
  mousePos: { x: number; y: number };
  wave: number;           // Incrementing this respawns the fish
  medalCount: number;     // Determines available colors
  onCatch: () => void;    // Callback when a fish is caught
  onAllCaught: () => void;// Callback when bowl is empty
  onBitten: () => void;   // Callback when turtle bites
  isGameOver: boolean;
}

// --- Configuration ---
const FISH_COUNT = 8;
const MAX_CONCURRENT_FISH = 15;
const MAX_TOTAL_SPAWN = 16;
const BASE_FISH_SPEED = 0.6;       
const RIPPLE_RADIUS_RATIO = 0.7; 
const RIPPLE_STRENGTH = 80;   
const RIPPLE_FREQ = 0.12;     
const RIPPLE_SPEED = 8.0;     
const AMBIENT_WAVE_STR = 5;   
const CATCH_RADIUS = 50;      
const TURTLE_HITBOX = 40;

// --- Colors Palette ---
const UNLOCKABLE_COLORS = [
  { body: '#FF7F50', fin: '#FF4500' }, 
  { body: '#F0F8FF', fin: '#87CEFA' }, 
  { body: '#FFD700', fin: '#DAA520' }, 
  { body: '#333333', fin: '#DC143C' }, 
  { body: '#DA70D6', fin: '#8A2BE2' }, 
];

// --- Types ---
interface Entity {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
}

interface Fish extends Entity {
  size: number;
  colorBody: string;
  colorFin: string;
  turnSpeed: number;
  tailOffset: number;
  targetAngle?: number;
  dead?: boolean;
}

interface Turtle extends Entity {
  size: number;
  legOffset: number;
}

interface Shark extends Entity {
  size: number;
  targetFishId?: number;
}

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  wobblePhase: number;
}

const FishBowl: React.FC<FishBowlProps> = ({ mousePos, wave, medalCount, onCatch, onAllCaught, onBitten, isGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const fishRef = useRef<Fish[]>([]);
  const turtlesRef = useRef<Turtle[]>([]);
  const sharksRef = useRef<Shark[]>([]);
  const bubblesRef = useRef<Bubble[]>([]);
  
  const startTimeRef = useRef<number>(Date.now());
  const isLevelClearedRef = useRef<boolean>(false);
  const lastCatchTimeRef = useRef<number>(Date.now()); 
  const lastSpawnTimeRef = useRef<number>(0);
  const fishSpawnedCountRef = useRef<number>(0);
  const radiusRef = useRef<number>(350);

  // --- Helper to create fish ---
  const createFish = (radius: number, colorSet: any): Fish => ({
    id: Date.now() + Math.random(),
    x: (Math.random() - 0.5) * radius * 1.2,
    y: (Math.random() - 0.5) * radius * 1.2,
    angle: Math.random() * Math.PI * 2,
    speed: BASE_FISH_SPEED * (0.8 + Math.random() * 0.4),
    size: 0.8 + Math.random() * 0.4,
    colorBody: colorSet.body,
    colorFin: colorSet.fin,
    turnSpeed: 0.01 + Math.random() * 0.02,
    tailOffset: Math.random() * 100,
  });

  // --- Initialize Level ---
  useEffect(() => {
    const initialRadius = Math.min(window.innerWidth, window.innerHeight) * 0.45;
    
    // 1. Spawn Fish
    const availableColorsCount = Math.min(UNLOCKABLE_COLORS.length, 1 + medalCount);
    const activePalette = UNLOCKABLE_COLORS.slice(0, availableColorsCount);

    const newFish: Fish[] = [];
    const initialCount = Math.min(FISH_COUNT, MAX_TOTAL_SPAWN);
    
    for (let i = 0; i < initialCount; i++) {
      const colorSet = activePalette[i % activePalette.length];
      newFish.push(createFish(initialRadius, colorSet));
    }
    fishRef.current = newFish;
    fishSpawnedCountRef.current = newFish.length;

    // 2. Spawn Turtles (1 in wave 0, 2 in wave 1, 3 in wave 2+)
    const turtleCount = wave === 0 ? 1 : (wave === 1 ? 2 : 3);
    const newTurtles: Turtle[] = [];
    for(let i=0; i<turtleCount; i++) {
        newTurtles.push({
            id: Date.now() + 1000 + i,
            x: (Math.random() - 0.5) * initialRadius,
            y: (Math.random() - 0.5) * initialRadius,
            angle: Math.random() * Math.PI * 2,
            speed: 0.2 + Math.random() * 0.2, // Slow
            size: 1 + Math.random() * 0.2,
            legOffset: Math.random() * 10
        });
    }
    turtlesRef.current = newTurtles;

    // 3. Spawn Sharks (Only Wave 5 and 6, index 4 and 5)
    const sharkCount = wave >= 4 ? 1 : 0; 
    const newSharks: Shark[] = [];
    for(let i=0; i<sharkCount; i++) {
        newSharks.push({
            id: Date.now() + 2000 + i,
            x: -initialRadius, // Start from edge
            y: 0,
            angle: 0,
            speed: 1.8, // Fast
            size: 1.5,
        });
    }
    sharksRef.current = newSharks;

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
      radiusRef.current = Math.min(canvas.width, canvas.height) * 0.42;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // --- Distortion Logic ---
    const getDistortion = (px: number, py: number, time: number, radius: number) => {
      const ambientX = Math.sin(py * 0.008 + time * 0.8) * AMBIENT_WAVE_STR;
      const ambientY = Math.cos(px * 0.008 + time * 0.8) * AMBIENT_WAVE_STR;

      let tx = px + ambientX;
      let ty = py + ambientY;

      // Mouse ripple
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

    // --- Draw Functions ---
    const drawCaustics = (ctx: CanvasRenderingContext2D, cx: number, cy: number, time: number, radius: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.95, 0, Math.PI * 2);
      ctx.clip(); 
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      const step = radius * 0.12; 
      
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

    const drawTurtle = (ctx: CanvasRenderingContext2D, t: Turtle, time: number, cx: number, cy: number, radius: number) => {
        const screenX = cx + t.x;
        const screenY = cy + t.y;
        const cos = Math.cos(t.angle);
        const sin = Math.sin(t.angle);
        const scale = t.size * (0.6 + (radius / 600));

        const transform = (lx: number, ly: number) => {
            const rx = (lx * cos - ly * sin) * scale;
            const ry = (lx * sin + ly * cos) * scale;
            return getDistortion(screenX + rx, screenY + ry, time, radius);
        };

        // Legs animation
        const legSwing = Math.sin(time * 3 + t.legOffset) * 5;

        // Draw Legs
        const legs = [
            { x: 15, y: -18 + legSwing }, { x: 15, y: 18 - legSwing },
            { x: -15, y: -18 - legSwing }, { x: -15, y: 18 + legSwing }
        ];
        ctx.fillStyle = '#556B2F'; // Dark Olive Green
        legs.forEach(pos => {
            const p = transform(pos.x, pos.y);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8 * scale, 0, Math.PI * 2);
            ctx.fill();
        });

        // Head
        const pHead = transform(28, 0);
        ctx.fillStyle = '#6B8E23';
        ctx.beginPath();
        ctx.arc(pHead.x, pHead.y, 10 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Shell
        const pShell = transform(0, 0);
        ctx.fillStyle = '#228B22'; // Forest Green
        ctx.beginPath();
        ctx.ellipse(pShell.x, pShell.y, 22 * scale, 18 * scale, t.angle, 0, Math.PI * 2);
        ctx.fill();
        
        // Shell Pattern
        ctx.fillStyle = '#006400'; // Dark Green
        ctx.beginPath();
        ctx.ellipse(pShell.x, pShell.y, 14 * scale, 10 * scale, t.angle, 0, Math.PI * 2);
        ctx.fill();
    };

    const drawShark = (ctx: CanvasRenderingContext2D, s: Shark, time: number, cx: number, cy: number, radius: number) => {
        const screenX = cx + s.x;
        const screenY = cy + s.y;
        const cos = Math.cos(s.angle);
        const sin = Math.sin(s.angle);
        const scale = s.size * (0.6 + (radius / 600));

        const transform = (lx: number, ly: number) => {
            const rx = (lx * cos - ly * sin) * scale;
            const ry = (lx * sin + ly * cos) * scale;
            return getDistortion(screenX + rx, screenY + ry, time, radius);
        };

        const tailWag = Math.sin(time * 10) * 10;

        // Tail
        const pTailBase = transform(-30, 0);
        const pTailTip1 = transform(-50, -15 + tailWag);
        const pTailTip2 = transform(-50, 15 + tailWag);
        
        ctx.fillStyle = '#4682B4'; // Steel Blue
        ctx.beginPath();
        ctx.moveTo(pTailBase.x, pTailBase.y);
        ctx.lineTo(pTailTip1.x, pTailTip1.y);
        ctx.lineTo(pTailTip2.x, pTailTip2.y);
        ctx.fill();

        // Dorsal Fin
        const pFinTop = transform(-5, -20);
        const pFinFront = transform(10, 0);
        const pFinBack = transform(-15, 0);
        ctx.beginPath();
        ctx.moveTo(pFinTop.x, pFinTop.y);
        ctx.lineTo(pFinFront.x, pFinFront.y);
        ctx.lineTo(pFinBack.x, pFinBack.y);
        ctx.fill();

        // Body
        const pNose = transform(40, 0);
        const pSideL = transform(-10, -12);
        const pSideR = transform(-10, 12);
        const pBack = transform(-30, 0);

        ctx.beginPath();
        ctx.moveTo(pNose.x, pNose.y);
        ctx.bezierCurveTo(pSideL.x, pSideL.y, pBack.x, pBack.y, pBack.x, pBack.y);
        ctx.bezierCurveTo(pSideR.x, pSideR.y, pNose.x, pNose.y, pNose.x, pNose.y);
        ctx.fill();

        // Eye
        const pEye = transform(25, -5);
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(pEye.x, pEye.y, 3 * scale, 0, Math.PI * 2);
        ctx.fill();
        const pPupil = transform(26, -5);
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(pPupil.x, pPupil.y, 1 * scale, 0, Math.PI * 2);
        ctx.fill();
    };

    // ... Reuse fish drawing and bubble logic from previous version ...
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

    const drawCuteFish = (ctx: CanvasRenderingContext2D, fish: Fish, time: number, cx: number, cy: number, radius: number) => {
        const screenX = cx + fish.x;
        const screenY = cy + fish.y;
        const cos = Math.cos(fish.angle);
        const sin = Math.sin(fish.angle);
        const scale = 0.6 + (radius / 600); 
        const t = (lx: number, ly: number) => {
            const rx = (lx * cos - ly * sin) * fish.size * scale;
            const ry = (lx * sin + ly * cos) * fish.size * scale;
            return getDistortion(screenX + rx, screenY + ry, time, radius);
        };
        const bodyLen = 25; const bodyWidth = 15;
        ctx.fillStyle = fish.colorBody;
        const pNose = t(bodyLen, 0); const pTailBase = t(-bodyLen, 0);
        const pTop = t(0, -bodyWidth); const pBottom = t(0, bodyWidth);
        const pTopFront = t(bodyLen*0.6, -bodyWidth*0.7); const pTopBack = t(-bodyLen*0.6, -bodyWidth*0.7);
        const pBotFront = t(bodyLen*0.6, bodyWidth*0.7); const pBotBack = t(-bodyLen*0.6, bodyWidth*0.7);
        ctx.beginPath(); ctx.moveTo(pNose.x, pNose.y);
        ctx.bezierCurveTo(pTopFront.x, pTopFront.y, pTop.x, pTop.y, pTopBack.x, pTopBack.y);
        ctx.lineTo(pTailBase.x, pTailBase.y);
        ctx.bezierCurveTo(pBotBack.x, pBotBack.y, pBottom.x, pBottom.y, pBotFront.x, pBotFront.y);
        ctx.closePath(); ctx.fill();
        const wiggle = Math.sin(time*6 + fish.tailOffset)*10;
        const tailLen = 20; const tailWid = 15;
        const pTailTipTop = t(-bodyLen-tailLen, -tailWid+wiggle);
        const pTailTipBot = t(-bodyLen-tailLen, tailWid+wiggle);
        const pTailMid = t(-bodyLen-tailLen*0.8, wiggle*0.5);
        ctx.fillStyle = fish.colorFin;
        ctx.beginPath(); ctx.moveTo(pTailBase.x, pTailBase.y);
        ctx.quadraticCurveTo(pTailMid.x, pTailMid.y, pTailTipTop.x, pTailTipTop.y);
        ctx.lineTo(pTailTipBot.x, pTailTipBot.y);
        ctx.quadraticCurveTo(pTailMid.x, pTailMid.y, pTailBase.x, pTailBase.y);
        ctx.fill();
        const finWiggle = Math.cos(time*8 + fish.tailOffset)*5;
        const pFinRoot = t(5, bodyWidth*0.8); const pFinTip = t(0, bodyWidth*0.8+12+finWiggle); const pFinBack = t(10, bodyWidth*0.8+8+finWiggle);
        ctx.beginPath(); ctx.moveTo(pFinRoot.x, pFinRoot.y); ctx.lineTo(pFinTip.x, pFinTip.y); ctx.lineTo(pFinBack.x, pFinBack.y); ctx.fill();
        const pFinRootL = t(5, -bodyWidth*0.8); const pFinTipL = t(0, -bodyWidth*0.8-12-finWiggle); const pFinBackL = t(10, -bodyWidth*0.8-8-finWiggle);
        ctx.beginPath(); ctx.moveTo(pFinRootL.x, pFinRootL.y); ctx.lineTo(pFinTipL.x, pFinTipL.y); ctx.lineTo(pFinBackL.x, pFinBackL.y); ctx.fill();
        const eyeX = 12; const eyeY = -6; const eyeSize = 6 * scale;
        const pEye = t(eyeX, eyeY); ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(pEye.x, pEye.y, eyeSize, 0, Math.PI*2); ctx.fill();
        const pPupil = t(eyeX+2, eyeY); ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(pPupil.x, pPupil.y, eyeSize/2.5, 0, Math.PI*2); ctx.fill();
        const pEye2 = t(eyeX, -eyeY); ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(pEye2.x, pEye2.y, eyeSize, 0, Math.PI*2); ctx.fill();
        const pPupil2 = t(eyeX+2, -eyeY); ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(pPupil2.x, pPupil2.y, eyeSize/2.5, 0, Math.PI*2); ctx.fill();
    };


    // --- Main Render Loop ---
    const render = () => {
      if (!ctx || !canvas || isGameOver) return;
      const now = Date.now();
      const time = (now - startTimeRef.current) / 1000;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = radiusRef.current;

      // --- Spawn Fish Logic ---
      // Check total spawned limit (16)
      const canSpawnTotal = fishSpawnedCountRef.current < MAX_TOTAL_SPAWN;
      // Check concurrent limit (15)
      const canSpawnConcurrent = fishRef.current.length < MAX_CONCURRENT_FISH;
      // Cooldown (1 second)
      const isSpawnCooldown = now - lastSpawnTimeRef.current < 1000;
      
      // Triggers:
      // 1. Idle for 2 seconds (Relaxing mode)
      const isIdle = now - lastCatchTimeRef.current > 2000;
      // 2. Low Fish Count (<= 1) (Challenge mode keep-alive)
      const isLowFish = fishRef.current.length <= 1;

      if (canSpawnTotal && canSpawnConcurrent && !isSpawnCooldown) {
          if (isIdle || isLowFish) {
              const availableColorsCount = Math.min(UNLOCKABLE_COLORS.length, 1 + medalCount);
              const activePalette = UNLOCKABLE_COLORS.slice(0, availableColorsCount);
              const colorSet = activePalette[Math.floor(Math.random() * activePalette.length)];
              
              fishRef.current.push(createFish(radius, colorSet));
              fishSpawnedCountRef.current++;
              lastSpawnTimeRef.current = now;
              // Note: We do NOT reset lastCatchTimeRef here, to preserve idle status if player remains idle
          }
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

      // 2. Caustics & Bubbles
      drawCaustics(ctx, cx + bowlWobbleX, cy + bowlWobbleY, time, radius);
      updateAndDrawBubbles(ctx, cx, cy, time, radius);

      // --- Entity Updates ---
      
      // Update Turtles
      turtlesRef.current.forEach(t => {
          t.x += Math.cos(t.angle) * t.speed;
          t.y += Math.sin(t.angle) * t.speed;
          // Bounce logic
          const dist = Math.sqrt(t.x * t.x + t.y * t.y);
          if (dist > radius - 40) {
              const angleToCenter = Math.atan2(-t.y, -t.x);
              t.angle = angleToCenter + (Math.random() - 0.5); 
          } else if (Math.random() < 0.01) {
              t.angle += (Math.random() - 0.5);
          }

          // Collision with Mouse
          const screenX = cx + t.x;
          const screenY = cy + t.y;
          const distToMouse = Math.sqrt(Math.pow(screenX - mousePos.x, 2) + Math.pow(screenY - mousePos.y, 2));
          if (distToMouse < TURTLE_HITBOX) {
              onBitten();
          }
      });

      // Update Sharks
      sharksRef.current.forEach(s => {
          // Find closest fish
          let closestFish: Fish | null = null;
          let minDist = Infinity;
          fishRef.current.forEach(f => {
              if (f.dead) return;
              const d = Math.sqrt(Math.pow(s.x - f.x, 2) + Math.pow(s.y - f.y, 2));
              if (d < minDist) {
                  minDist = d;
                  closestFish = f;
              }
          });

          if (closestFish) {
              const f = closestFish as Fish;
              const angleToFish = Math.atan2(f.y - s.y, f.x - s.x);
              // Turn towards fish
              let diff = angleToFish - s.angle;
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              s.angle += Math.sign(diff) * 0.05;
              
              // Move
              s.x += Math.cos(s.angle) * s.speed;
              s.y += Math.sin(s.angle) * s.speed;

              // Eat Fish
              if (minDist < 30) {
                  f.dead = true;
                  soundManager.playChomp();
                  // Check win condition immediately if shark eats last fish
                  // Note: Since fishRef is filtered below, we check if it becomes empty in the next frame logic, 
                  // or do it right here after filtering.
              }
          } else {
              // Wander if no fish
              s.x += Math.cos(s.angle) * s.speed;
              s.y += Math.sin(s.angle) * s.speed;
              const dist = Math.sqrt(s.x * s.x + s.y * s.y);
              if (dist > radius) {
                  const angleToCenter = Math.atan2(-s.y, -s.x);
                  s.angle = angleToCenter;
              }
          }
      });

      // Filter Dead Fish
      const fishBefore = fishRef.current.length;
      fishRef.current = fishRef.current.filter(f => !f.dead);
      const fishAfter = fishRef.current.length;
      
      // Update Fish Movement
      fishRef.current.forEach(fish => {
        fish.x += Math.cos(fish.angle) * fish.speed;
        fish.y += Math.sin(fish.angle) * fish.speed;
        const dist = Math.sqrt(fish.x * fish.x + fish.y * fish.y);
        const boundary = radius - 60; 
        if (dist > boundary) {
          const angleToCenter = Math.atan2(-fish.y, -fish.x);
          let diff = angleToCenter - fish.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          const urgency = dist > radius ? 4 : 2;
          fish.angle += Math.sign(diff) * fish.turnSpeed * urgency;
        } else {
          if (Math.random() < 0.01) fish.targetAngle = fish.angle + (Math.random() - 0.5) * 2;
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
        const distToMouse = Math.sqrt(Math.pow(screenX - mousePos.x, 2) + Math.pow(screenY - mousePos.y, 2));
        if (distToMouse < CATCH_RADIUS && !fish.dead) {
          fish.dead = true;
          lastCatchTimeRef.current = Date.now(); 
          onCatch();
        }
      });

      // Draw Entities in order
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      
      sharksRef.current.forEach(s => drawShark(ctx, s, time, cx, cy, radius));
      turtlesRef.current.forEach(t => drawTurtle(ctx, t, time, cx, cy, radius));
      fishRef.current.forEach(fish => drawCuteFish(ctx, fish, time, cx, cy, radius));
      
      ctx.restore();

      // Check for Level Clear (if all fish gone, whether by cat or shark)
      if (fishRef.current.length === 0 && !isLevelClearedRef.current) {
         // Also check if we have exhausted the spawn pool
         if (fishSpawnedCountRef.current >= MAX_TOTAL_SPAWN) {
             isLevelClearedRef.current = true;
             onAllCaught();
         }
      }

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
  }, [mousePos, medalCount, isGameOver]); 

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute top-0 left-0 w-full h-full block touch-none"
    />
  );
};

export default FishBowl;