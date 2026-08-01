"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface GameModalContextValue {
  activeGameId: string | null;
  openGame: (gameId: string) => void;
  closeGame: () => void;
}

const GameModalContext = createContext<GameModalContextValue | null>(null);

export function GameModalProvider({ children }: { children: ReactNode }) {
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  const openGame = useCallback((gameId: string) => setActiveGameId(gameId), []);
  const closeGame = useCallback(() => setActiveGameId(null), []);

  const value = useMemo(
    () => ({ activeGameId, openGame, closeGame }),
    [activeGameId, openGame, closeGame]
  );

  return <GameModalContext.Provider value={value}>{children}</GameModalContext.Provider>;
}

export function useGameModal(): GameModalContextValue {
  const ctx = useContext(GameModalContext);
  if (!ctx) {
    throw new Error("useGameModal must be used within a GameModalProvider");
  }
  return ctx;
}
