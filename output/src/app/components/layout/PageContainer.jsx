export function PageContainer({ children, title, subtitle, action }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-secondary/50 p-6">
      <div className="max-w-7xl mx-auto">
        {(title || action) && (
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              {title && (
                <h1 className="text-3xl text-foreground">{title}</h1>
              )}
              {subtitle && (
                <p className="mt-1 text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {action && (
              <div className="flex-shrink-0">
                {action}
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
