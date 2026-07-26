import React from 'react';
import { normalizeLegacyRole } from '../utils/roleUtils';

export const RoleBadge = ({ role }: { role: string }) => {
  const finalRole = normalizeLegacyRole(role);

  const styles = {
    Admin: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
    Staff: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
    Reviewee: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${styles[finalRole]}`}>
      {finalRole}
    </span>
  );
};
