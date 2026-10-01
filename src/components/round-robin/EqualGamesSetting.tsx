import { Switch } from "@/components/ui/switch";

export function EqualGamesSetting({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="col-span-full flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
      <span>
        <span className="block text-sm font-semibold">Equal games for everyone</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          Allow extra rests and partly used rounds. If needed, raise the target to the next possible equal count shown below.
          With this off, fill courts and balance games as closely as possible.
        </span>
      </span>
      <Switch aria-label="Equal games for everyone" checked={value} onCheckedChange={onChange} />
    </label>
  );
}
