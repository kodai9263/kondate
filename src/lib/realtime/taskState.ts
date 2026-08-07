export type TodayTaskBinding = {
  planEntryId: string | null;
  stepId: string | null;
  text: string;
  checked: boolean;
};

export type TodayTaskBindings = {
  breakfast: TodayTaskBinding[];
  morning: TodayTaskBinding[];
  evening: TodayTaskBinding[];
};

export function updateTaskBindings(
  bindings: TodayTaskBindings,
  stepId: string,
  checked: boolean,
): TodayTaskBindings {
  return {
    breakfast: updateGroup(bindings.breakfast, stepId, checked),
    morning: updateGroup(bindings.morning, stepId, checked),
    evening: updateGroup(bindings.evening, stepId, checked),
  };
}

export function countCheckedTasks(bindings: TodayTaskBindings): number {
  return [...bindings.breakfast, ...bindings.morning, ...bindings.evening].filter((task) => task.checked).length;
}

function updateGroup(tasks: TodayTaskBinding[], stepId: string, checked: boolean): TodayTaskBinding[] {
  return tasks.map((task) => task.stepId === stepId ? { ...task, checked } : task);
}
