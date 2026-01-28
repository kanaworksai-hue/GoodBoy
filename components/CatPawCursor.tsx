import React from 'react';

interface CatPawCursorProps {
  x: number;
  y: number;
}

const CatPawCursor: React.FC<CatPawCursorProps> = ({ x, y }) => {
  return (
    <div
      className="fixed pointer-events-none z-50 will-change-transform"
      style={{
        left: 0,
        top: 0,
        transform: `translate(${x}px, ${y}px) translate(-10%, -10%)`, 
      }}
    >
      {/* Cat Paw SVG */}
      <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-2xl opacity-90">
        {/* Main Pad */}
        <path 
            d="M50 55 C35 55 25 45 30 35 C35 25 65 25 70 35 C75 45 65 55 50 55Z" 
            fill="#F4A460" stroke="#8B4513" strokeWidth="2"
        />
        <ellipse cx="50" cy="40" rx="15" ry="10" fill="#FFE4E1" />

        {/* Toes */}
        {/* Toe 1 */}
        <circle cx="20" cy="25" r="10" fill="#F4A460" stroke="#8B4513" strokeWidth="2" />
        <circle cx="20" cy="25" r="5" fill="#FFE4E1" />
        
        {/* Toe 2 */}
        <circle cx="40" cy="12" r="11" fill="#F4A460" stroke="#8B4513" strokeWidth="2" />
        <circle cx="40" cy="12" r="5.5" fill="#FFE4E1" />

        {/* Toe 3 */}
        <circle cx="65" cy="12" r="11" fill="#F4A460" stroke="#8B4513" strokeWidth="2" />
        <circle cx="65" cy="12" r="5.5" fill="#FFE4E1" />

        {/* Toe 4 */}
        <circle cx="85" cy="25" r="10" fill="#F4A460" stroke="#8B4513" strokeWidth="2" />
        <circle cx="85" cy="25" r="5" fill="#FFE4E1" />
        
        {/* Claws (Retracted/Subtle) */}
        <path d="M40 2 L40 5" stroke="#333" strokeWidth="1" />
        <path d="M65 2 L65 5" stroke="#333" strokeWidth="1" />
      </svg>
    </div>
  );
};

export default CatPawCursor;