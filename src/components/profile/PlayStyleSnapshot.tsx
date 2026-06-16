interface PlayStyleSnapshotProps {
  power: number;
  control: number;
  consistency: number;
}

export const PlayStyleSnapshot = ({ power, control, consistency }: PlayStyleSnapshotProps) => {
  const styles = [
    { label: 'Power', value: power },
    { label: 'Control', value: control },
    { label: 'Consistency', value: consistency },
  ];

  return (
    <div className="space-y-2 mt-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3 font-sans">Play Style</p>
      {styles.map((style) => (
        <div key={style.label} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-sans text-muted-foreground">{style.label}</span>
            <span className="font-sans font-medium">{style.value}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#CC9332] rounded-full transition-all duration-500"
              style={{ width: `${style.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
