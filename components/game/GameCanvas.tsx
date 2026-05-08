'use client';

import { useEffect, useRef, useCallback } from 'react';
import { GameEngine, createPlayer } from '@/lib/game/engine';
import type { Player, UIState } from '@/lib/game/types';

interface Props {
  player: Player;
  onStateUpdate: (state: UIState) => void;
  engineRef: React.MutableRefObject<GameEngine | null>;
}

export function GameCanvas({ player, onStateUpdate, engineRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleResize = useCallback(() => {
    if (!canvasRef.current || !engineRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    engineRef.current.resizeCanvas(window.innerWidth, window.innerHeight);
  }, [engineRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const engine = new GameEngine(canvas, player, onStateUpdate);
    engineRef.current = engine;
    engine.start();

    window.addEventListener('resize', handleResize);

    return () => {
      engine.stop();
      engineRef.current = null;
      window.removeEventListener('resize', handleResize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', position: 'fixed', inset: 0, zIndex: 0 }}
    />
  );
}
