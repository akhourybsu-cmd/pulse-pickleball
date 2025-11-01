export const LiveIndicator = () => {
  return (
    <div className="fixed top-4 right-4 flex items-center gap-3 bg-green-600/90 backdrop-blur-sm px-4 py-2.5 rounded-full border-2 border-green-400 z-50 shadow-lg">
      <div className="relative">
        <div className="w-4 h-4 bg-white rounded-full animate-pulse" />
        <div className="absolute inset-0 w-4 h-4 bg-white rounded-full animate-ping" />
      </div>
      <span className="text-base font-bold text-white tracking-wide">LIVE</span>
    </div>
  );
};
