import type { ReactNode } from "react";

type InfoCardProps = {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
};

export const InfoCard = ({ icon, title, children }: InfoCardProps) => (
  <article className="info-card">
    <div className="info-card__icon" aria-hidden="true">
      {icon}
    </div>

    <div className="info-card__content">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  </article>
);

export default InfoCard;
