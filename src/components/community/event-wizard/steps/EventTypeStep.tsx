import { EventWizardFormData, EVENT_TYPE_OPTIONS } from '../types';

interface EventTypeStepProps {
  value: EventWizardFormData['eventType'];
  onChange: (type: EventWizardFormData['eventType']) => void;
}

export function EventTypeStep({ value, onChange }: EventTypeStepProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">What type of event?</h3>
      <div className="grid grid-cols-2 gap-2">
        {EVENT_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`p-3 rounded-lg border-2 text-left transition-all ${
              value === option.value
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
            }`}
          >
            <span className="text-xl mb-1 block">{option.icon}</span>
            <span className="font-medium text-sm">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
