import { useRef, useState } from "react";

/** One in-flight event mutation, acquired before React renders the busy state. */
export function useRoundRobinAction() {
  const active = useRef<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);

  async function run<T>(nextLabel: string, work: () => Promise<T>): Promise<T> {
    if (active.current) {
      throw new Error(
        "An event update is still running. Wait for it to finish, then try again."
      );
    }
    active.current = nextLabel;
    setLabel(nextLabel);
    try {
      return await work();
    } finally {
      active.current = null;
      setLabel(null);
    }
  }

  // Form callers must receive a rejection: a blocked save is never success.
  function guard<Args extends unknown[], Result>(
    nextLabel: string,
    work: (...args: Args) => Promise<Result>
  ) {
    return (...args: Args) => run(nextLabel, () => work(...args));
  }

  // Direct page buttons ignore repeat taps; the existing action stays visible.
  function guardClick<Args extends unknown[]>(
    nextLabel: string,
    work: (...args: Args) => Promise<unknown>
  ) {
    return async (...args: Args): Promise<void> => {
      if (active.current) return;
      await run(nextLabel, () => work(...args));
    };
  }

  return { label, guard, guardClick, isBusy: () => active.current !== null };
}
