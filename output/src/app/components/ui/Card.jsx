export function Card({ children, className = '', hover = false, onClick }) {
  const hoverClass = hover ? 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer' : '';
  const clickable = onClick ? 'cursor-pointer' : '';
  
  return (
    <div
      className={`bg-card border border-border rounded-2xl shadow-sm transition-all duration-300 ${hoverClass} ${clickable} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`p-6 border-b border-border ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}
