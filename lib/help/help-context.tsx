"use client";

import * as React from "react";

interface HelpCtx {
  helpActive: boolean;
  toggleHelp: () => void;
}

const Ctx = React.createContext<HelpCtx>({ helpActive: false, toggleHelp: () => {} });

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [helpActive, setHelpActive] = React.useState(false);
  const toggleHelp = React.useCallback(() => setHelpActive((p) => !p), []);
  return <Ctx.Provider value={{ helpActive, toggleHelp }}>{children}</Ctx.Provider>;
}

export function useHelp() {
  return React.useContext(Ctx);
}
