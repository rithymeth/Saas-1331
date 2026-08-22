"use client";

type Props = {
  memberId: string;
  currentRole: string;
  action: (formData: FormData) => void;
};

export function MemberRoleSelect({ memberId, currentRole, action }: Props) {
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <select
        name="role"
        defaultValue={currentRole}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
      >
        <option value="ADMIN">Admin</option>
        <option value="MEMBER">Member</option>
      </select>
    </form>
  );
}
