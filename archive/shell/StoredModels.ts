// ARCHIVED 0.9.3 — not imported, not compiled.
// These types were only used by the retired PersonalShell and its
// shell-only storage helpers.

export type TaskStatus = "doing" | "scheduled" | "done";

export type StoredTask = {
  id: string;
  text: string;
  detail: string;
  status: TaskStatus;
  done: boolean;
};

export type StoredMemory = {
  id: string;
  category: string;
  text: string;
};
