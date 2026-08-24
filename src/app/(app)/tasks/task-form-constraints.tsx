'use client';

import { createContext, useContext } from 'react';
import type { TaskDepartment } from '@/types/database';

type TaskFormConstraints = {
  lockedDepartment: TaskDepartment | null;
};

const TaskFormConstraintsContext = createContext<TaskFormConstraints>({ lockedDepartment: null });

export function TaskFormConstraintsProvider({
  lockedDepartment,
  children,
}: {
  lockedDepartment: TaskDepartment | null;
  children: React.ReactNode;
}) {
  return (
    <TaskFormConstraintsContext.Provider value={{ lockedDepartment }}>
      {children}
    </TaskFormConstraintsContext.Provider>
  );
}

export function useTaskFormConstraints(): TaskFormConstraints {
  return useContext(TaskFormConstraintsContext);
}
