import React from 'react';

type SidebarBrandingProps = {
  role: "Admin" | "Staff" | "Reviewee";
  idNumber?: string | null;
  className?: string;
};

export function SidebarBranding({ role, idNumber, className = "" }: SidebarBrandingProps) {
  return (
    <div className={`text-center shrink-0 pt-6 px-5 pb-5 ${className}`}>
      <a 
        href="https://samaritanreviewcenter.com/student/" 
        className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm overflow-hidden hover:opacity-90 transition-opacity cursor-pointer block"
      >
        <img src="/logo.svg" alt="SRC Logo" className="h-full w-full object-contain p-2" />
      </a>
    </div>
  );
}
