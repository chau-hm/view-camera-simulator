import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

type SiteShellProps = {
  children: ReactNode;
  className?: string;
};

export const SiteShell = ({ children, className = "" }: SiteShellProps) => (
  <div className={`site-shell ${className}`.trim()}>
    <SiteHeader />
    <main className="site-main">{children}</main>
    <SiteFooter />
  </div>
);
