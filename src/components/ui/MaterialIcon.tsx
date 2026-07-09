type MaterialIconProps = {
  name: string;
  size?: number;
  className?: string;
  title?: string;
};

export const MaterialIcon = ({ name, size = 20, className, title }: MaterialIconProps) => (
  <span
    className={["material-symbols-outlined", className].filter(Boolean).join(" ")}
    aria-hidden={title ? undefined : "true"}
    title={title}
    style={{ fontSize: size, lineHeight: 1 }}
  >
    {name}
  </span>
);

export default MaterialIcon;
