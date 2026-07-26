import React from "react";

type SidebarBrandHeaderProps = {
  className?: string;
};

export function SidebarBrandHeader({
  className = "",
}: SidebarBrandHeaderProps) {
  return (
    <div
      className={[
        "w-full shrink-0 bg-white px-5 pb-5 pt-5 text-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <a
        href="https://samaritanreviewcenter.com/student/"
        aria-label="Open Samaritan Review Center"
        className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm transition duration-200 hover:opacity-90 animate-fade-in"
      >
        <img
          src="/logo.svg"
          alt="Samaritan Review Center Logo"
          className="h-full w-full object-contain p-2"
        />
      </a>

      <h2 className="mt-4 text-[21px] font-black uppercase leading-[1.02] tracking-tight text-[#07152f]">
        SAMARITAN
        <br />
        REVIEW CENTER
      </h2>

      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.32em] text-[#007c89]">
        GRTMNDS
      </p>
    </div>
  );
}

export default SidebarBrandHeader;
