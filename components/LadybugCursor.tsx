import React from 'react';

interface LadybugCursorProps {
  x: number;
  y: number;
}

const LadybugCursor: React.FC<LadybugCursorProps> = ({ x, y }) => {
  return (
    <div
      className="fixed pointer-events-none z-50 will-change-transform"
      style={{
        left: 0,
        top: 0,
        transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
      }}
    >
      {/* Ladybug SVG */}
      <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-xl">
        {/* Legs */}
        <path d="M20 20 L35 35" stroke="#333" strokeWidth="4" strokeLinecap="round" />
        <path d="M80 20 L65 35" stroke="#333" strokeWidth="4" strokeLinecap="round" />
        <path d="M15 50 L30 50" stroke="#333" strokeWidth="4" strokeLinecap="round" />
        <path d="M85 50 L70 50" stroke="#333" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 80 L35 65" stroke="#333" strokeWidth="4" strokeLinecap="round" />
        <path d="M80 80 L65 65" stroke="#333" strokeWidth="4" strokeLinecap="round" />

        {/* Body (Red Shell) */}
        <circle cx="50" cy="55" r="35" fill="#EF4444" stroke="#991B1B" strokeWidth="1" />
        
        {/* Head */}
        <path d="M30 35 Q50 10 70 35 Z" fill="#111" />
        
        {/* Central Line */}
        <path d="M50 35 L50 90" stroke="#333" strokeWidth="2" opacity="0.6" />

        {/* Spots */}
        <circle cx="38" cy="50" r="4" fill="#111" />
        <circle cx="62" cy="50" r="4" fill="#111" />
        <circle cx="42" cy="70" r="3" fill="#111" />
        <circle cx="58" cy="70" r="3" fill="#111" />
        <circle cx="35" cy="62" r="2.5" fill="#111" />
        <circle cx="65" cy="62" r="2.5" fill="#111" />

        {/* Antennae */}
        <path d="M35 25 Q30 10 20 15" stroke="#111" strokeWidth="2" fill="none" />
        <path d="M65 25 Q70 10 80 15" stroke="#111" strokeWidth="2" fill="none" />
      </svg>
    </div>
  );
};

export default LadybugCursor;