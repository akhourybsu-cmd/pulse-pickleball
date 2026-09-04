import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * PULSE activity bar — a bottom-anchored heartbeat/progress graphic that
 * signals "work is happening" for operations that take a beat (adding a
 * player, regenerating rounds, substituting, saving scores).
 *
 * Replaces the "silence then a stack of toasts" experience: the bar sweeps
 * while the task runs, then snaps to a full, brighter bar for a moment when
 * the task completes so the user sees the finish.
 */

type Phase = "running" | "done" | "error";

interface Task {
  id: number;
  label: string;
  phase: Phase;
  doneLabel?: string;
}

let seq = 0;
let tasks: Task[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function useTasks(): Task[] {
  const [snapshot, setSnapshot] = useState<Task[]>(tasks);
  useEffect(() => {
    const l = () => setSnapshot([...tasks]);
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return snapshot;
}

/** Start a pulse task manually. Call the returned finisher when done. */
export function startPulseActivity(label: string) {
  const id = ++seq;
  tasks = [...tasks, { id, label, phase: "running" }];
  emit();
  let settled = false;
  const settle = (phase: Phase, doneLabel?: string) => {
    if (settled) return;
    settled = true;
    tasks = tasks.map((t) => (t.id === id ? { ...t, phase, doneLabel } : t));
    emit();
    setTimeout(() => {
      tasks = tasks.filter((t) => t.id !== id);
      emit();
    }, phase === "error" ? 1400 : 900);
  };
  return {
    done: (doneLabel?: string) => settle("done", doneLabel),
    fail: (doneLabel?: string) => settle("error", doneLabel),
  };
}

/**
 * Wrap an async operation with the pulse bar.
 * `doneLabel` is shown briefly on the completed bar.
 */
export async function withPulseActivity<T>(
  label: string,
  fn: () => Promise<T>,
  doneLabel?: string | ((result: T) => string),
): Promise<T> {
  const handle = startPulseActivity(label);
  try {
    const result = await fn();
    handle.done(typeof doneLabel === "function" ? doneLabel(result) : doneLabel);
    return result;
  } catch (e) {
    handle.fail();
    throw e;
  }
}

/** Mount once near the app root. */
export function PulseActivityBar() {
  const all = useTasks();
  const task = all[all.length - 1];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {task && (
          <div
            key={task.id}
            className="pulse-activity-enter w-full max-w-sm rounded-2xl border border-border/70 bg-background/85 px-4 py-3 shadow-lg backdrop-blur-xl"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  task.phase === "error" ? "bg-destructive" : "bg-primary",
                  task.phase === "running" && "animate-pulse",
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">
                {task.phase === "error"
                  ? "Something went wrong"
                  : task.phase === "done"
                    ? task.doneLabel ?? "Done"
                    : task.label}
              </span>
            </div>

            {/* Heartbeat track */}
            <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
              {task.phase === "running" ? (
                <div className="pulse-activity-sweep absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
              ) : (
                <div
                  className={cn(
                    "pulse-activity-complete absolute inset-y-0 left-0 rounded-full",
                    task.phase === "error" ? "bg-destructive" : "bg-primary",
                  )}
                />
              )}
            </div>
          </div>
      )}
    </div>
  );
}
