/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Play, Skull } from 'lucide-react';

// --- Constants ---
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const GROUND_Y = 160; // Base Y position for dino on ground
const DINO_WIDTH = 44;
const DINO_HEIGHT = 44;
const OBSTACLE_WIDTH = 36;
const OBSTACLE_HEIGHT = 48;
const INITIAL_SPEED = 5;
const SPEED_INCREMENT = 0.001;
const SPAWN_CHANCE = 0.02;
const MIN_SPAWN_GAP = 60; // Minimum frames between obstacles in the same layer

type GameStatus = 'START' | 'PLAYING' | 'GAME_OVER';

interface ObstacleData {
  id: number;
  x: number;
  type: 'tree' | 'cactus';
}

interface DinoState {
  y: number;
  vy: number;
  isJumping: boolean;
}

export default function App() {
  const [status, setStatus] = useState<GameStatus>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  
  // Game State Refs (for the game loop to avoid closure issues)
  const gameRef = useRef({
    speed: INITIAL_SPEED,
    score: 0,
    topDino: { y: GROUND_Y, vy: 0, isJumping: false } as DinoState,
    bottomDino: { y: GROUND_Y, vy: 0, isJumping: false } as DinoState,
    topObstacles: [] as ObstacleData[],
    bottomObstacles: [] as ObstacleData[],
    lastTopSpawn: 0,
    lastBottomSpawn: 0,
    frameCount: 0,
  });

  // UI State (synced from refs for rendering)
  const [renderState, setRenderState] = useState({
    topDinoY: GROUND_Y,
    bottomDinoY: GROUND_Y,
    topObstacles: [] as ObstacleData[],
    bottomObstacles: [] as ObstacleData[],
  });

  const requestRef = useRef<number>(null);

  const startGame = () => {
    gameRef.current = {
      speed: INITIAL_SPEED,
      score: 0,
      topDino: { y: GROUND_Y, vy: 0, isJumping: false },
      bottomDino: { y: GROUND_Y, vy: 0, isJumping: false },
      topObstacles: [],
      bottomObstacles: [],
      lastTopSpawn: 0,
      lastBottomSpawn: 0,
      frameCount: 0,
    };
    setScore(0);
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
    g.score += 0.1;
    setScore(Math.floor(g.score));

    // Update Dinos
    [g.topDino, g.bottomDino].forEach(dino => {
      if (dino.isJumping) {
        dino.vy += GRAVITY;
        dino.y += dino.vy;
        if (dino.y >= GROUND_Y) {
          dino.y = GROUND_Y;
          dino.vy = 0;
          dino.isJumping = false;
        }
      }
    });

    // Update Obstacles
    const updateLayer = (obstacles: ObstacleData[], lastSpawn: number) => {
      // Move
      obstacles.forEach(obs => obs.x -= g.speed);
      // Filter off-screen
      const filtered = obstacles.filter(obs => obs.x > -50);
      // Spawn new
      if (g.frameCount - lastSpawn > MIN_SPAWN_GAP && Math.random() < SPAWN_CHANCE) {
        filtered.push({
          id: Date.now() + Math.random(),
          x: window.innerWidth + 50,
          type: Math.random() > 0.5 ? 'tree' : 'cactus'
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
        const dinoBox = { left: 40, right: 40 + DINO_WIDTH - 10, top: dino.y, bottom: dino.y + DINO_HEIGHT };
        const obsBox = { left: obs.x + 5, right: obs.x + OBSTACLE_WIDTH - 5, top: GROUND_Y, bottom: GROUND_Y + OBSTACLE_HEIGHT };
        
        return !(dinoBox.right < obsBox.left || 
                 dinoBox.left > obsBox.right || 
                 dinoBox.bottom < obsBox.top || 
                 dinoBox.top > obsBox.bottom);
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
      onTouchStart={handleTouch}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="p-4 flex justify-between items-center bg-white/80 backdrop-blur-sm z-20 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <span className="font-mono font-bold text-gray-600">HI: {highScore.toString().padStart(5, '0')}</span>
        </div>
        <div className="text-2xl font-mono font-black text-gray-800">
          {score.toString().padStart(5, '0')}
        </div>
      </div>

      {/* Game Tracks */}
      <div className="flex-1 flex flex-col">
        {/* Top Track */}
        <div className="flex-1 relative border-b-2 border-dashed border-gray-300 overflow-hidden bg-sky-50/30">
          <div className="absolute bottom-0 w-full h-0.5 bg-gray-400" />
          <Dinosaur y={renderState.topDinoY} src="https://i.ibb.co/Txw2vPTP/LOGO-copy.png" />
          {renderState.topObstacles.map(obs => (
            <Obstacle key={obs.id} x={obs.x} type={obs.type} />
          ))}
          <div className="absolute top-4 left-4 text-[10px] uppercase tracking-widest text-gray-400 font-bold">Upper Realm</div>
        </div>

        {/* Bottom Track */}
        <div className="flex-1 relative overflow-hidden bg-emerald-50/30">
          <div className="absolute bottom-0 w-full h-0.5 bg-gray-400" />
          <Dinosaur y={renderState.bottomDinoY} src="https://i.ibb.co/LhZxnN4H/LOGO.png" />
          {renderState.bottomObstacles.map(obs => (
            <Obstacle key={obs.id} x={obs.x} type={obs.type} />
          ))}
          <div className="absolute top-4 left-4 text-[10px] uppercase tracking-widest text-gray-400 font-bold">Lower Realm</div>
        </div>
      </div>

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
      style={{ top: y, width: DINO_WIDTH, height: DINO_HEIGHT }}
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

function Obstacle({ x, type }: { x: number; type: 'tree' | 'cactus'; key?: React.Key }) {
  return (
    <div 
      className="absolute transition-none"
      style={{ left: x, top: GROUND_Y, width: OBSTACLE_WIDTH, height: OBSTACLE_HEIGHT }}
    >
      <img 
        src="https://i.ibb.co/FLSGtWV5/image.png" 
        alt={type}
        className="w-full h-full object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

// --- Vector Assets ---
