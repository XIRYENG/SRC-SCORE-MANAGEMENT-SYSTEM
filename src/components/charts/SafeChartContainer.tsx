import React from "react";

class SafeChartErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.log("Chart rendering error caught gracefully:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-red-500/20 bg-red-500/5 text-sm text-red-400/80 p-4 text-center">
          <div>
            <p className="font-bold mb-1">Visualization Unavailable</p>
            <p className="text-xs text-slate-400">An unexpected error occurred while rendering this chart.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type SafeChartContainerProps = {
  children: React.ReactNode;
  height?: number;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
};

export function SafeChartContainer({
  children,
  height = 280,
  loading = false,
  empty = false,
  emptyMessage = "No chart data available.",
  className = "",
}: SafeChartContainerProps) {
  const containerRef =
    React.useRef<HTMLDivElement | null>(
      null,
    );

  const [hasSize, setHasSize] =
    React.useState(false);

  React.useEffect(() => {
    const element =
      containerRef.current;

    if (!element) {
      return;
    }

    const checkSize = () => {
      const rect =
        element.getBoundingClientRect();

      setHasSize(
        rect.width > 1 &&
        rect.height > 1,
      );
    };

    checkSize();

    const observer =
      new ResizeObserver(checkSize);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full min-w-0 ${className}`}
      style={{
        height,
        minHeight: height,
      }}
    >
      {loading ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          Loading chart…
        </div>
      ) : empty ? (
        <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
          {emptyMessage}
        </div>
      ) : hasSize ? (
        <SafeChartErrorBoundary>
          {children}
        </SafeChartErrorBoundary>
      ) : (
        <div className="h-full w-full" />
      )}
    </div>
  );
}
