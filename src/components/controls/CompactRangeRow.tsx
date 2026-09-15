import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type CompactRangeRowProps = {
  label: ReactNode;
  value: ReactNode;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
  active?: boolean;
  trailing?: ReactNode;
};

/** Shared label/slider/value layout used by the compact camera control rail. */
export const CompactRangeRow = ({
  label,
  value,
  inputProps,
  active = false,
  trailing,
}: CompactRangeRowProps) => {
  const generatedInputId = useId();
  const { className, id, ...restInputProps } = inputProps;
  const inputId = id ?? generatedInputId;
  const hasTrailing = trailing !== undefined && trailing !== null;

  return (
    <div
      className={`compact-range-row${hasTrailing ? " compact-range-row--with-trailing" : ""}`}
      data-active={active ? "true" : "false"}
    >
      <label className="compact-range-row__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        {...restInputProps}
        id={inputId}
        className={`range-slider compact-range-row__slider${className ? ` ${className}` : ""}`}
      />
      <output className="compact-range-row__value">{value}</output>
      {hasTrailing ? (
        <span className="compact-range-row__trailing">{trailing}</span>
      ) : null}
    </div>
  );
};
