import { ButtonHTMLAttributes, forwardRef } from 'react';



export const Button = forwardRef(
  ({ variant = 'primary', size = 'md', fullWidth = false, className = '', disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg transition-all duration-200 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-primary text-primary-foreground hover:bg-[#05AA5A] active:bg-[#049F51]',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-[#EBEBEB] active:bg-[#E0E0E0]',
      outline: 'border-2 border-border bg-transparent hover:bg-secondary active:bg-[#EBEBEB]',
      ghost: 'bg-transparent hover:bg-secondary active:bg-[#EBEBEB]',
      destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 active:opacity-80'
    };
    
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-6 py-3',
      lg: 'px-8 py-4 text-lg' };
    
    const widthClass = fullWidth ? 'w-full' : '';
    
    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
