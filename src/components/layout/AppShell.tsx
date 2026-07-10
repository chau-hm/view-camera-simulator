import type { ReactNode } from "react";

type AppShellProps = {
  title: string;
  children: ReactNode;
  globalErrorMessage?: string | null;
  fullBleed?: boolean;
};

import { SiteShell } from "./SiteShell";

export const AppShell = ({ title, children, globalErrorMessage = null, fullBleed = false }: AppShellProps) => {
  if (fullBleed) {
    // Simulator and other full-bleed pages render without the site header/footer
    return (
      <div className="page page--full-bleed">
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
  }

  // Regular site pages use the shared SiteShell which includes header/footer
  return (
    <SiteShell>
      <section aria-live="polite" data-testid="global-error-area" role={globalErrorMessage ? "alert" : "status"}>
        {globalErrorMessage}
      </section>

      <div className="marketing-container">
        {title ? <h1>{title}</h1> : null}
        {children}
      </div>
    </SiteShell>
  );
};
