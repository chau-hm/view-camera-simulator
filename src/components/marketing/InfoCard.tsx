import React from "react";

type InfoCardProps = {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
};

export const InfoCard = ({ icon, title, children }: InfoCardProps) => (
  <div className="info-card" role="article">
    <div className="info-card__icon" aria-hidden>
      {icon}
    </div>
    <div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  </div>
);

export default InfoCard;
