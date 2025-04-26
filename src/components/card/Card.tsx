import { cn } from "@/lib/utils";

type CardProps = {
  as?: React.ElementType;
  children?: React.ReactNode;
  className?: string;
  ref?: React.Ref<HTMLElement>;
  tabIndex?: number;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  onClick?: React.MouseEventHandler<HTMLDivElement>;
};

export const Card = ({
  as,
  children,
  className,
  ref,
  tabIndex,
  variant = "secondary",
  onClick,
}: CardProps) => {
  const Component = as ?? "div";
  return (
    <Component
      className={cn(
        "w-full rounded-lg p-4",
        {
          "btn-primary": variant === "primary",
          "btn-secondary": variant === "secondary",
        },
        className
      )}
      ref={ref}
      tabIndex={tabIndex}
      onClick={onClick} // <-- and added here
    >
      {children}
    </Component>
  );
};
