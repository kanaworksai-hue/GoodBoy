import React, { useRef, useEffect } from 'react';

interface FireworksProps {
  duration?: number;
}

const Fireworks: React.FC<FireworksProps> = ({ duration }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      alpha: number;
      color: string;
    }

    let particles: Particle[] = [];

    const createExplosion = (x: number, y: number) => {
      const colors = ['#FFD700', '#FF4500', '#00BFFF', '#32CD32', '#FF69B4'];
      const particleCount = 100;
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 2;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    // Auto launch fireworks
    const interval = setInterval(() => {
        createExplosion(
            window.innerWidth * 0.2 + Math.random() * window.innerWidth * 0.6,
            window.innerHeight * 0.2 + Math.random() * window.innerHeight * 0.5
        );
    }, 800);

    createExplosion(window.innerWidth / 2, window.innerHeight / 2);

    let stopTimeout: ReturnType<typeof setTimeout>;
    if (duration) {
      stopTimeout = setTimeout(() => {
        clearInterval(interval);
      }, duration);
    }

    const animate = () => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // Gravity
        p.alpha -= 0.015;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(animate);
    };

    const animId = requestAnimationFrame(animate);

    return () => {
      clearInterval(interval);
      if (stopTimeout) clearTimeout(stopTimeout);
      cancelAnimationFrame(animId);
    };
  }, [duration]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none z-40"
    />
  );
};

export default Fireworks;