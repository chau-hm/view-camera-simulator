import type { ReactNode } from "react";

type AppShellProps = {
  title: string;
  children: ReactNode;
  globalErrorMessage?: string | null;
  fullBleed?: boolean;
  useSiteShell?: boolean;
};

import { SiteShell } from "./SiteShell";

export const AppShell = ({ title, children, globalErrorMessage = null, fullBleed = false, useSiteShell = false }: AppShellProps) => {
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

  // If caller requests the shared site shell, or no title is provided, render SiteShell.
  if (useSiteShell || !title) {
    return (
      <SiteShell>
        <section aria-live="polite" data-testid="global-error-area" role={globalErrorMessage ? "alert" : "status"}>
          {globalErrorMessage}
        </section>

        <div className="marketing-container">
          {!title ? null : <h1>{title}</h1>}
          {children}
        </div>
      </SiteShell>
    );
  }

  // Default simple page shell for contexts without a site header/footer
  return (
    <div className="page">
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
};
