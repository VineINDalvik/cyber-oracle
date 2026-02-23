"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Mode = "daily" | "draw" | "compat" | "dream";

interface OracleState {
  mode: Mode;
}

interface OracleActions {
  setMode: (mode: Mode) => void;
}

const OracleContext = createContext<(OracleState & OracleActions) | null>(null);

export function OracleProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("daily");
  const setMode = useCallback((m: Mode) => setModeState(m), []);

  return (
    <OracleContext.Provider value={{ mode, setMode }}>
      {children}
    </OracleContext.Provider>
  );
}

export function useOracle() {
  const ctx = useContext(OracleContext);
  if (!ctx) throw new Error("useOracle must be used within OracleProvider");
  return ctx;
}
