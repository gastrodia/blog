import React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  className = "",
  disabled = false,
  children,
  ...rest
}) => {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={[
        "rounded-md px-3 py-2",
        "border border-gray-300 dark:border-gray-600",
        "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700",
        "active:bg-gray-300 dark:active:bg-gray-600",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "cursor-pointer transition-colors",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
};

export default Button;
