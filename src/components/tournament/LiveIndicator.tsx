export const LiveIndicator = () => {
  return (
    <div className="fixed top-4 right-4 flex items-center gap-2 bg-background/80 backdrop-blur-sm px-3 py-2 rounded-full border border-border z-50">
      <div className="relative">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping" />
      </div>
      <span className="text-sm font-medium text-foreground">Live Updating</span>
    </div>
  );
};
