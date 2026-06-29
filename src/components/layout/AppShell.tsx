import type { ReactNode } from "react";

type AppShellProps = {
  title: string;
  children: ReactNode;
  globalErrorMessage?: string | null;
};

export const AppShell = ({ title, children, globalErrorMessage = null }: AppShellProps) => (
  <div className="page">
    <header>
      <h1>{title}</h1>
    </header>
    <section aria-live="polite" data-testid="global-error-area" role={globalErrorMessage ? "alert" : "status"}>
      {globalErrorMessage}
    </section>
    <main>{children}</main>
  </div>
);
