import type { ReactNode } from "react";

type AppShellProps = {
  title: string;
  children: ReactNode;
};

export const AppShell = ({ title, children }: AppShellProps) => (
  <div className="page">
    <header>
      <h1>{title}</h1>
    </header>
    <main>{children}</main>
  </div>
);
