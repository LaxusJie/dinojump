/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Play, Skull } from 'lucide-react';

// --- Constants ---
const GRAVITY = 0.4;
const JUMP_FORCE = 10;
const GROUND_ALTITUDE = 0; 
const DINO_WIDTH = 44;
const DINO_HEIGHT = 44;
const OBSTACLE_WIDTH = 36;
const OBSTACLE_HEIGHT = 40;
const INITIAL_SPEED = 6;
const SPEED_INCREMENT = 0.0008;
const SPAWN_CHANCE = 0.015;
const MIN_SPAWN_GAP = 80;

type GameStatus = 'START' | 'PLAYING' | 'GAME_OVER';
type ObstacleType = 'tree' | 'cactus' | 'bird' | 'rock' | 'bush';

interface ObstacleData {
  id: number;
  x: number;
  type: ObstacleType;
  yOffset?: number; // Altitude for flying birds
}

interface DinoState {
  y: number; // Altitude above ground
  vy: number;
  isJumping: boolean;
}

export default function App() {
  const [status, setStatus] = useState<GameStatus>('START');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  
  // Game State Refs (for the game loop to avoid closure issues)
  const gameRef = useRef({
    speed: INITIAL_SPEED,
    score: 0,
    level: 1,
    nextLevelScore: 300,
    scoreIncrement: 0.1,
    topDino: { y: GROUND_ALTITUDE, vy: 0, isJumping: false } as DinoState,
    bottomDino: { y: GROUND_ALTITUDE, vy: 0, isJumping: false } as DinoState,
    topObstacles: [] as ObstacleData[],
    bottomObstacles: [] as ObstacleData[],
    lastTopSpawn: 0,
    lastBottomSpawn: 0,
    frameCount: 0,
  });

  // UI State (synced from refs for rendering)
  const [renderState, setRenderState] = useState({
    topDinoY: GROUND_ALTITUDE,
    bottomDinoY: GROUND_ALTITUDE,
    topObstacles: [] as ObstacleData[],
    bottomObstacles: [] as ObstacleData[],
  });

  const requestRef = useRef<number>(null);

  const startGame = () => {
    gameRef.current = {
      speed: INITIAL_SPEED,
      score: 0,
      level: 1,
      nextLevelScore: 300,
      scoreIncrement: 0.1,
      topDino: { y: GROUND_ALTITUDE, vy: 0, isJumping: false },
      bottomDino: { y: GROUND_ALTITUDE, vy: 0, isJumping: false },
      topObstacles: [],
      bottomObstacles: [],
      lastTopSpawn: 0,
      lastBottomSpawn: 0,
      frameCount: 0,
    };
    setScore(0);
    setLevel(1);
    setStatus('PLAYING');
  };

  const jump = useCallback((layer: 'top' | 'bottom') => {
    const dino = layer === 'top' ? gameRef.current.topDino : gameRef.current.bottomDino;
    if (!dino.isJumping) {
      dino.vy = JUMP_FORCE;
      dino.isJumping = true;
    }
  }, []);

  const handleInput = useCallback((e?: React.TouchEvent | React.MouseEvent | KeyboardEvent) => {
    if (status !== 'PLAYING') return;

    // For keyboard: Space or ArrowUp jumps both? 
    // Actually, let's make it more interesting: 
    // Left side of screen / 'w' for top, Right side / 'ArrowUp' for bottom.
    // But the user said "上下速度和障碍方向可以是一样的", implying a single control might be intended?
    // "但上下障碍是独立进入的" - this usually means you need to jump independently.
    // Let's implement independent jumping: 
    // Touch top half -> top dino jumps. Touch bottom half -> bottom dino jumps.
    
    if (e instanceof KeyboardEvent) {
      if (e.key === 'w' || e.key === 'W') jump('top');
      if (e.key === 'ArrowUp' || e.key === ' ') jump('bottom');
    }
  }, [status, jump]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (status !== 'PLAYING') return;
    // Prevent mouse event if touch already handled it
    const clickX = e.clientX;
    const screenWidth = window.innerWidth;
    if (clickX < screenWidth / 2) {
      jump('top');
    } else {
      jump('bottom');
    }
  };

  const handleTouch = (e: React.TouchEvent) => {
    if (status !== 'PLAYING') return;
    // e.preventDefault(); // Optional: prevent mouse emulation
    const touchX = e.touches[0].clientX;
    const screenWidth = window.innerWidth;
    if (touchX < screenWidth / 2) {
      jump('top');
    } else {
      jump('bottom');
    }
  };

  const update = useCallback(() => {
    if (status !== 'PLAYING') return;

    const g = gameRef.current;
    g.frameCount++;
    g.speed += SPEED_INCREMENT;
    g.score += g.scoreIncrement;
    
    // Level Up Logic
    if (g.score >= g.nextLevelScore) {
      g.level++;
      g.nextLevelScore = Math.floor(g.nextLevelScore * 1.1);
      g.speed += 0.3; // Level up speed boost
      g.scoreIncrement *= 1.1; // Level up score multiplier
      setLevel(g.level);
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 2000);
    }

    setScore(Math.floor(g.score));

    // Update Dinos
    [g.topDino, g.bottomDino].forEach(dino => {
      if (dino.isJumping) {
        dino.vy -= GRAVITY;
        dino.y += dino.vy;
        if (dino.y <= GROUND_ALTITUDE) {
          dino.y = GROUND_ALTITUDE;
          dino.vy = 0;
          dino.isJumping = false;
        }
      }
    });

    // Update Obstacles
    const updateLayer = (obstacles: ObstacleData[], lastSpawn: number) => {
      obstacles.forEach(obs => obs.x -= g.speed);
      const filtered = obstacles.filter(obs => obs.x > -100);
      
      if (g.frameCount - lastSpawn > MIN_SPAWN_GAP && Math.random() < SPAWN_CHANCE) {
        const types: ObstacleType[] = ['tree', 'cactus', 'bird', 'rock', 'bush'];
        const type = types[Math.floor(Math.random() * types.length)];
        const isBird = type === 'bird';
        
        filtered.push({
          id: Date.now() + Math.random(),
          x: window.innerWidth + 100,
          type: type,
          yOffset: isBird ? 30 + Math.random() * 40 : 0
        });
        return { filtered, spawned: true };
      }
      return { filtered, spawned: false };
    };

    const topRes = updateLayer(g.topObstacles, g.lastTopSpawn);
    g.topObstacles = topRes.filtered;
    if (topRes.spawned) g.lastTopSpawn = g.frameCount;

    const bottomRes = updateLayer(g.bottomObstacles, g.lastBottomSpawn);
    g.bottomObstacles = bottomRes.filtered;
    if (bottomRes.spawned) g.lastBottomSpawn = g.frameCount;

    // Collision Detection
    const checkCollision = (dino: DinoState, obstacles: ObstacleData[]) => {
      return obstacles.some(obs => {
        const obsAlt = obs.yOffset || 0;
        const dinoBox = { 
          left: 40, 
          right: 40 + DINO_WIDTH - 12, 
          bottom: dino.y + 5, 
          top: dino.y + DINO_HEIGHT - 5 
        };
        const obsBox = { 
          left: obs.x + 8, 
          right: obs.x + OBSTACLE_WIDTH - 8, 
          bottom: obsAlt + 5, 
          top: obsAlt + OBSTACLE_HEIGHT - 5 
        };
        
        return !(dinoBox.right < obsBox.left || 
                 dinoBox.left > obsBox.right || 
                 dinoBox.top < obsBox.bottom || 
                 dinoBox.bottom > obsBox.top);
      });
    };

    if (checkCollision(g.topDino, g.topObstacles) || checkCollision(g.bottomDino, g.bottomObstacles)) {
      setStatus('GAME_OVER');
      if (Math.floor(g.score) > highScore) setHighScore(Math.floor(g.score));
      return;
    }

    setRenderState({
      topDinoY: g.topDino.y,
      bottomDinoY: g.bottomDino.y,
      topObstacles: [...g.topObstacles],
      bottomObstacles: [...g.bottomObstacles],
    });

    requestRef.current = requestAnimationFrame(update);
  }, [status, highScore]);

  useEffect(() => {
    if (status === 'PLAYING') {
      requestRef.current = requestAnimationFrame(update);
      window.addEventListener('keydown', handleInput);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener('keydown', handleInput);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener('keydown', handleInput);
    };
  }, [status, update, handleInput]);

  return (
    <div 
      className="fixed inset-0 bg-[#f7f7f7] flex flex-col overflow-hidden font-sans select-none touch-none"
      style={{ 
        paddingLeft: 'env(safe-area-inset-left)', 
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
      onTouchStart={handleTouch}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div 
        className="p-4 flex justify-between items-center bg-white/80 backdrop-blur-sm z-20 border-b border-gray-200"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="font-mono font-bold text-gray-600">HI: {highScore.toString().padStart(5, '0')}</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-900 text-white px-3 py-1 rounded-full text-xs font-black italic tracking-tighter">
            LVL {level}
          </div>
        </div>
        <div className="text-2xl font-mono font-black text-gray-800">
          {score.toString().padStart(5, '0')}
        </div>
      </div>

      {/* Level Up Toast */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 80, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute inset-x-0 flex justify-center z-50 pointer-events-none"
          >
            <div className="bg-yellow-400 text-gray-900 px-6 py-2 rounded-full font-black shadow-xl border-2 border-gray-900 flex items-center gap-2">
              <Play className="w-4 h-4 fill-current rotate-[-90deg]" />
              LEVEL UP! SPEED & SCORE BOOSTED
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Tracks */}
      <div className="flex-1 flex flex-col">
        {/* Top Track */}
        <div className="flex-1 relative border-b-4 border-white/20 overflow-hidden bg-gradient-to-b from-sky-400 to-sky-200">
          <ParallaxBackground speed={gameRef.current.speed * 0.2} type="top" />
          <div className="absolute bottom-0 w-full h-1 bg-white/30" />
          <Dinosaur y={renderState.topDinoY} src="https://i.ibb.co/Txw2vPTP/LOGO-copy.png" />
          {renderState.topObstacles.map(obs => (
            <Obstacle key={obs.id} x={obs.x} type={obs.type} yOffset={obs.yOffset} />
          ))}
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full backdrop-blur-md">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest text-white font-bold">Sky Realm</span>
          </div>
        </div>

        {/* Bottom Track */}
        <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-[#f4d03f] to-[#eb984e]">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/sandpaper.png')] pointer-events-none" />
          <ParallaxBackground speed={gameRef.current.speed * 0.2} type="bottom" />
          <div className="absolute bottom-0 w-full h-1 bg-[#873600]/30" />
          <Dinosaur y={renderState.bottomDinoY} src="https://i.ibb.co/LhZxnN4H/LOGO.png" />
          {renderState.bottomObstacles.map(obs => (
            <Obstacle key={obs.id} x={obs.x} type={obs.type} yOffset={obs.yOffset} />
          ))}
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
            <div className="w-2 h-2 bg-yellow-200 rounded-full animate-pulse shadow-[0_0_8px_rgba(254,240,138,0.8)]" />
            <span className="text-[10px] uppercase tracking-widest text-white font-bold">Golden Desert</span>
          </div>
          {/* Sun Glow */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-yellow-200/20 blur-[100px] rounded-full pointer-events-none" />
        </div>
      </div>

      <OrientationOverlay />

      {/* Overlays */}
      <AnimatePresence>
        {status === 'START' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-white/90 flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="mb-6"
            >
              <img 
                src="https://i.ibb.co/LhZxnN4H/LOGO.png" 
                alt="Dino"
                className="w-24 h-24 object-contain"
                referrerPolicy="no-referrer"
              />
            </motion.div>
            <h1 className="text-4xl font-black text-gray-800 mb-2 uppercase tracking-tighter italic">Dual Dino</h1>
            <p className="text-gray-500 mb-8 max-w-xs">Jump independently in both realms. Don't let either dino hit an obstacle!</p>
            <button 
              onClick={startGame}
              className="group relative px-8 py-4 bg-gray-900 text-white rounded-full font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
            >
              <Play className="w-5 h-5 fill-current" />
              START ADVENTURE
              <div className="absolute -inset-1 bg-gray-900/20 rounded-full blur-lg group-hover:bg-gray-900/40 transition-colors" />
            </button>
            <div className="mt-8 grid grid-cols-2 gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              <div>Top: Left Side / 'W'</div>
              <div>Bottom: Right Side / '↑'</div>
            </div>
          </motion.div>
        )}

        {status === 'GAME_OVER' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-30 bg-red-500/10 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="bg-white p-8 rounded-3xl shadow-2xl border-4 border-gray-900 max-w-xs w-full">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Skull className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-1 uppercase tracking-tighter">EXTINCT!</h2>
              <div className="text-gray-500 mb-6 font-mono">SCORE: {score.toString().padStart(5, '0')}</div>
              
              <button 
                onClick={startGame}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-95 transition-all"
              >
                <RotateCcw className="w-5 h-5" />
                TRY AGAIN
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Instructions Overlay (Briefly shown at start) */}
      {status === 'PLAYING' && score < 50 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-none flex z-10"
        >
          <div className="flex-1 flex flex-col items-center justify-center bg-black/5 border-r border-black/10 animate-pulse">
            <div className="w-12 h-12 border-2 border-gray-400 rounded-full flex items-center justify-center">←</div>
            <span className="text-[10px] font-bold mt-2">JUMP TOP</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center bg-black/5 animate-pulse">
            <div className="w-12 h-12 border-2 border-gray-400 rounded-full flex items-center justify-center">→</div>
            <span className="text-[10px] font-bold mt-2">JUMP BOTTOM</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// --- Sub-components ---

function Dinosaur({ y, src }: { y: number; src: string; key?: React.Key }) {
  return (
    <div 
      className="absolute left-10 transition-none"
      style={{ bottom: y, width: DINO_WIDTH, height: DINO_HEIGHT }}
    >
      <img 
        src={src} 
        alt="Dino"
        className="w-full h-full object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function Obstacle({ x, type, yOffset = 0 }: { x: number; type: ObstacleType; yOffset?: number; key?: React.Key }) {
  const getAsset = () => {
    switch(type) {
      case 'bird': return "https://i.ibb.co/fYPVNLJs/image.png";
      case 'rock': return "https://img.icons8.com/color/96/rock.png";
      case 'bush': return "https://i.ibb.co/FLSGtWV5/image.png";
      case 'cactus': return "https://i.ibb.co/TMz5ZyF0/image.png";
      case 'tree': return "https://i.ibb.co/7x7FjbdS/image.png";
      default: return "https://i.ibb.co/TMz5ZyF0/image.png";
    }
  };

  return (
    <div 
      className="absolute transition-none"
      style={{ 
        left: x, 
        bottom: yOffset, 
        width: OBSTACLE_WIDTH, 
        height: OBSTACLE_HEIGHT 
      }}
    >
      <img 
        src={getAsset()} 
        alt={type}
        className="w-full h-full object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function ParallaxBackground({ speed, type }: { speed: number, type: 'top' | 'bottom' }) {
  const [offset, setOffset] = useState(0);
  
  useEffect(() => {
    let frameId: number;
    const animate = () => {
      setOffset(prev => (prev - speed) % 2000);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [speed]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {type === 'top' ? (
        <div className="opacity-30">
          {/* Clouds */}
          <div 
            className="absolute top-10 flex gap-40 whitespace-nowrap"
            style={{ transform: `translateX(${offset * 0.5}px)` }}
          >
            {[...Array(10)].map((_, i) => (
              <img key={i} src="https://img.icons8.com/color/96/cloud.png" className="w-24 h-24" alt="" />
            ))}
          </div>
          {/* Mountains */}
          <div 
            className="absolute bottom-0 flex items-end whitespace-nowrap"
            style={{ transform: `translateX(${offset * 0.2}px)` }}
          >
            {[...Array(10)].map((_, i) => (
              <div key={i} className="w-80 h-40 bg-white/20 rounded-t-[100px] -ml-20" />
            ))}
          </div>
        </div>
      ) : (
        <div className="opacity-50">
          {/* Distant Dunes */}
          <div 
            className="absolute bottom-0 flex items-end whitespace-nowrap"
            style={{ transform: `translateX(${offset * 0.2}px)` }}
          >
            {[...Array(10)].map((_, i) => (
              <div key={i} className="w-[500px] h-32 bg-[#ba4a00]/10 rounded-t-[250px] -ml-40" />
            ))}
          </div>
          {/* Near Dunes */}
          <div 
            className="absolute bottom-0 flex items-end whitespace-nowrap"
            style={{ transform: `translateX(${offset * 0.4}px)` }}
          >
            {[...Array(10)].map((_, i) => (
              <div key={i} className="w-[400px] h-20 bg-[#d35400]/20 rounded-t-[200px] -ml-20" />
            ))}
          </div>
          {/* Desert Rocks / Tumbleweeds */}
          <div 
            className="absolute bottom-4 flex items-end gap-40 whitespace-nowrap"
            style={{ transform: `translateX(${offset * 0.7}px)` }}
          >
            {[...Array(15)].map((_, i) => (
              <div key={i} className="w-3 h-3 bg-[#5d4037]/40 rounded-full blur-[1px]" />
            ))}
          </div>
          {/* Heat Haze Effect */}
          <motion.div 
            animate={{ opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute bottom-0 w-full h-12 bg-gradient-to-t from-[#f39c12]/10 to-transparent"
          />
        </div>
      )}
    </div>
  );
}

function OrientationOverlay() {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const check = () => {
      // iPhone 14 landscape is roughly 19.5:9, so we check if height is greater than width
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!isPortrait) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col items-center justify-center p-10 text-center text-white">
      <motion.div
        animate={{ rotate: 90 }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="mb-8"
      >
        <RotateCcw className="w-20 h-20 text-yellow-400" />
      </motion.div>
      <h2 className="text-3xl font-black mb-4 tracking-tighter uppercase italic">Rotate for Adventure</h2>
      <p className="text-gray-400 max-w-xs leading-relaxed">
        iPhone 14 users: Please turn your device to <span className="text-white font-bold">Landscape</span> mode for the best dual-realm experience!
      </p>
      <div className="mt-8 w-1 h-12 bg-white/20 rounded-full animate-bounce" />
    </div>
  );
}

// --- Vector Assets ---
