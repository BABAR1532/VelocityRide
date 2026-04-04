import { InputHTMLAttributes, forwardRef } from 'react';



export const Input = forwardRef(
  ({ label, error, fullWidth = false, className = '', ...props }, ref) => {
    const inputType = props.type;
    const typeSpecificClass =
      inputType === 'date' || inputType === 'time' || inputType === 'datetime-local'
        ? // Ensure the browser date/time picker controls remain clickable.
          'appearance-auto cursor-pointer'
        : '';

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label className="block mb-2 text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-3 bg-input-background border border-input rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground ${
            error ? 'border-destructive focus:ring-destructive' : ''
          } ${typeSpecificClass} ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
