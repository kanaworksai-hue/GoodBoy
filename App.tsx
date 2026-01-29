import React, { useState, useEffect, useCallback } from 'react';
import FishBowl from './components/FishBowl';
import CatPawCursor from './components/CatPawCursor';
import Fireworks from './components/Fireworks';
import { soundManager } from './utils/SoundManager';

const App: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [score, setScore] = useState(0); // Represents USD debt
  const [medals, setMedals] = useState(0);
  const [wave, setWave] = useState(0); 
  const [showReward, setShowReward] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [endingType, setEndingType] = useState<'standard' | 'master'>('standard');
  const [audioStarted, setAudioStarted] = useState(false);

  // Initialize Audio on first interaction
  const handleStartAudio = useCallback(() => {
    if (!audioStarted) {
      soundManager.resume();
      setAudioStarted(true);
    }
  }, [audioStarted]);

  // Track global mouse and touch position
  useEffect(() => {
    const updatePos = (clientX: number, clientY: number) => {
      setMousePos({ x: clientX, y: clientY });
    };

    const handleMouseMove = (e: MouseEvent) => {
      updatePos(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Prevent scrolling while playing
      if (e.touches.length > 0) {
        updatePos(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
       if (e.touches.length > 0) {
        updatePos(e.touches[0].clientX, e.touches[0].clientY);
      }
      handleStartAudio(); // Also start audio on touch
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleStartAudio);
    
    // Touch events for mobile
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleStartAudio);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [handleStartAudio]);

  const handleCatch = useCallback(() => {
    if (gameWon) return;

    soundManager.playCatch();
    setScore(prev => {
      const newScore = prev - 10;
      // Hidden Ending Check: Score > 880 (Absolute value)
      if (Math.abs(newScore) >= 880) {
         setEndingType('master');
         setGameWon(true);
         soundManager.playGameWin();
      }
      return newScore;
    });
  }, [gameWon]);

  const handleAllCaught = useCallback(() => {
    if (gameWon) return;

    // Win condition: Finish 6 waves (0 to 5)
    if (wave >= 5) {
      setEndingType('standard');
      setGameWon(true);
      soundManager.playGameWin();
      return;
    }

    // Show Fireworks and Medal reward, Play Meow
    setShowReward(true);
    soundManager.playMedal();
    soundManager.playMeow(); 

    // Delay next wave to celebrate
    setTimeout(() => {
      setMedals(prev => Math.min(prev + 1, 5));
      setWave(prev => prev + 1); 
      setShowReward(false);
    }, 4000);
  }, [gameWon, wave]);

  const resetGame = useCallback(() => {
    setScore(0);
    setMedals(0);
    setWave(0);
    setGameWon(false);
    setShowReward(false);
    setEndingType('standard');
    soundManager.resume(); // Restart music
  }, []);

  return (
    <div 
      className="relative w-full h-screen bg-gradient-to-b from-cyan-900 via-blue-900 to-slate-900 overflow-hidden font-serif cursor-none touch-none"
    >
      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none z-20 text-cyan-100">
        <div>
           <h1 className="text-4xl tracking-widest uppercase drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-amber-500">
            GOOD BOY
          </h1>
          <p className="text-cyan-300 text-sm mt-1 italic opacity-80">
            {audioStarted ? "Don't touch my fish!" : "Tap/Click to start music"}
          </p>
        </div>
        
        <div className="text-right">
          <div className="text-3xl font-mono font-bold drop-shadow-md mb-2 text-red-400">
            Owner has lost $ {Math.abs(score)}
          </div>
          <div className="flex gap-2 justify-end">
             {Array.from({ length: medals }).map((_, i) => (
               <span key={i} className="text-2xl animate-bounce" style={{ animationDelay: `${i*0.1}s` }}>🏅</span>
             ))}
             {Array.from({ length: Math.max(0, 5 - medals) }).map((_, i) => (
               <span key={i} className="text-2xl opacity-20 grayscale">🏅</span>
             ))}
          </div>
        </div>
      </div>

      {/* Audio Hint */}
      {!audioStarted && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 animate-pulse pointer-events-none text-white/50 flex flex-col items-center">
            <span className="text-xs tracking-widest uppercase">Tap to unmute</span>
        </div>
      )}

      {/* Round Clear Reward Overlay */}
      {showReward && !gameWon && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-500">
           <div className="text-6xl mb-4 animate-bounce">🐱🏅</div>
           <h2 className="text-5xl font-bold text-yellow-300 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] stroke-black">
             So Happy
           </h2>
        </div>
      )}

      {/* Win Screen */}
      {gameWon && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 animate-in fade-in duration-1000 cursor-auto pointer-events-auto">
           <h2 className={`text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-b ${endingType === 'master' ? 'from-purple-300 to-pink-500' : 'from-yellow-300 to-orange-500'} drop-shadow-[0_4px_0_rgba(0,0,0,1)] stroke-black mb-6 animate-bounce text-center`}>
             {endingType === 'master' ? 'Fishing Cat Master' : 'GOOD BOY'}
           </h2>
           <div className="text-2xl text-white font-mono bg-red-600 px-8 py-4 rounded-lg border-4 border-white transform rotate-[-2deg] mb-8 text-center max-w-xl">
              <p className="text-xl opacity-80 mb-2">Owner has lost $ {Math.abs(score)}</p>
              <p className="font-bold text-3xl">
                {endingType === 'master' 
                  ? "Fishing is all about patience… and sharp claws."
                  : <>"I will keep playful again.<br/>See you later!"</>
                }
              </p>
           </div>
           
           <button 
             onClick={(e) => {
               e.stopPropagation();
               resetGame();
             }}
             className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-full text-xl shadow-lg transition-transform hover:scale-105 active:scale-95 border-2 border-cyan-200"
           >
             Play Again
           </button>
        </div>
      )}

      {/* Fireworks (On Round Clear or Win) */}
      {(showReward || gameWon) && <Fireworks duration={gameWon ? 5000 : undefined} />}

      {/* Main Canvas */}
      <FishBowl 
        mousePos={mousePos} 
        wave={wave}
        medalCount={medals}
        onCatch={handleCatch}
        onAllCaught={handleAllCaught}
      />

      {/* Custom Cursor (Hide when game won or on touch devices if possible, though strict media query in JS is complex, simple rendering is fine) */}
      {!gameWon && <CatPawCursor x={mousePos.x} y={mousePos.y} />}
    </div>
  );
};

export default App;