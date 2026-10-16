'use client';

import { createContext, useContext } from 'react';
import type { TaskDepartment } from '@/types/database';

type TaskFormConstraints = {
  lockedDepartment: TaskDepartment | null;
  lockSelfAssigneeId: string | null;
};

const TaskFormConstraintsContext = createContext<TaskFormConstraints>({
  lockedDepartment: null,
  lockSelfAssigneeId: null,
});

export function TaskFormConstraintsProvider({
  lockedDepartment,
  lockSelfAssigneeId = null,
  children,
}: {
  lockedDepartment: TaskDepartment | null;
  lockSelfAssigneeId?: string | null;
  children: React.ReactNode;
}) {
  return (
    <TaskFormConstraintsContext.Provider value={{ lockedDepartment, lockSelfAssigneeId }}>
      {children}
    </TaskFormConstraintsContext.Provider>
  );
}

export function useTaskFormConstraints(): TaskFormConstraints {
  return useContext(TaskFormConstraintsContext);
}
