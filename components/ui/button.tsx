import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[9px] whitespace-nowrap rounded-control font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[15px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "border border-border bg-card text-foreground hover:bg-surface",
        ghost: "text-muted-foreground hover:bg-surface hover:text-foreground",
        link: "text-primary hover:text-primary-hover",
        locked: "bg-[#f2f4f7] text-faint-foreground cursor-not-allowed disabled:opacity-100",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-[18px] py-[11px] text-[13px]",
        lg: "px-5 py-3 text-[13.5px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
