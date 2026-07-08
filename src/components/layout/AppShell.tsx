import type { ReactNode } from "react";

type AppShellProps = {
  title: string;
  children: ReactNode;
  globalErrorMessage?: string | null;
  fullBleed?: boolean;
};

export const AppShell = ({ title, children, globalErrorMessage = null, fullBleed = false }: AppShellProps) => (
  <div className="page" style={fullBleed ? { padding: 0 } : undefined}>
    {title ? (
      <header>
        <h1>{title}</h1>
      </header>
    ) : null}
    <section aria-live="polite" data-testid="global-error-area" role={globalErrorMessage ? "alert" : "status"}>
      {globalErrorMessage}
    </section>
    <main>{children}</main>
  </div>
);
