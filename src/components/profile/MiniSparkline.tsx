interface MiniSparklineProps {
  data: number[];
}

export const MiniSparkline = ({ data }: MiniSparklineProps) => {
  if (data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 30;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const isUptrend = data[data.length - 1] >= data[0];

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={isUptrend ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
          strokeWidth="2"
          className="transition-all duration-300"
        />
        {data.map((value, index) => {
          const x = (index / (data.length - 1)) * width;
          const y = height - ((value - min) / range) * height;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="2"
              fill={isUptrend ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
            />
          );
        })}
      </svg>
      <span className={`text-xs ${isUptrend ? 'text-primary' : 'text-destructive'}`}>
        {isUptrend ? '↗' : '↘'}
      </span>
    </div>
  );
};
