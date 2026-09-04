"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: Date | null;
  assignee: { name: string | null; email: string } | null;
};

type Props = {
  projectId: string;
  tasks: Task[];
  updateTaskStatus: (formData: FormData) => void;
  deleteTask: (formData: FormData) => void;
};

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "Todo" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "DONE", label: "Done" },
];

export function TaskBoard({ projectId, tasks, updateTaskStatus, deleteTask }: Props) {
  const [, startTransition] = useTransition();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  function moveTask(taskId: string, status: TaskStatus) {
    const formData = new FormData();
    formData.set("taskId", taskId);
    formData.set("status", status);
    startTransition(() => {
      updateTaskStatus(formData);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {COLUMNS.map((column) => (
        <div
          key={column.status}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverStatus(column.status);
          }}
          onDragLeave={() => setDragOverStatus((s) => (s === column.status ? null : s))}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverStatus(null);
            if (draggingTaskId) moveTask(draggingTaskId, column.status);
          }}
          className="flex flex-col gap-3"
        >
          <h2 className="text-sm font-medium text-gray-500">
            {column.label} · {tasks.filter((t) => t.status === column.status).length}
          </h2>
          <div
            className={`flex flex-col gap-2 rounded-md p-1 transition-colors ${
              dragOverStatus === column.status ? "bg-gray-100" : ""
            }`}
          >
            {tasks
              .filter((task) => task.status === column.status)
              .map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => setDraggingTaskId(task.id)}
                  onDragEnd={() => {
                    setDraggingTaskId(null);
                    setDragOverStatus(null);
                  }}
                  className="flex cursor-grab flex-col gap-2 rounded-md border border-gray-200 p-3 active:cursor-grabbing"
                >
                  <p className="text-sm font-medium">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-gray-600">{task.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {task.assignee && <span>{task.assignee.name ?? task.assignee.email}</span>}
                    {task.dueDate && <span>Due {task.dueDate.toLocaleDateString()}</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <select
                      defaultValue={task.status}
                      onChange={(e) => moveTask(task.id, e.currentTarget.value as TaskStatus)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="TODO">Todo</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/projects/${projectId}/tasks/${task.id}/edit`}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Edit
                      </Link>
                      <form action={deleteTask}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <button type="submit" className="text-xs text-red-600 hover:underline">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            {tasks.filter((t) => t.status === column.status).length === 0 && (
              <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400">
                No tasks
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
