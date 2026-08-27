"use client";

type Props = {
  taskId: string;
  currentStatus: string;
  action: (formData: FormData) => void;
};

export function TaskStatusSelect({ taskId, currentStatus, action }: Props) {
  return (
    <form action={action}>
      <input type="hidden" name="taskId" value={taskId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
      >
        <option value="TODO">Todo</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="DONE">Done</option>
      </select>
    </form>
  );
}
