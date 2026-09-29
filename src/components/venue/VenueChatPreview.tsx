import type { VenueBrand } from '@/lib/venues/branding';
import { incomingBubble, outgoingBubble } from '@/lib/chat/bubbleStyles';
import { VenueTheme } from './VenueTheme';

export function VenueChatPreview({ brand }: { brand: VenueBrand }) {
  return <VenueTheme brand={brand} className="overflow-hidden rounded-xl border" >
    <div className="border-b bg-card px-4 py-3 text-sm font-semibold">Chat color preview</div>
    <div className="venue-chat-messages space-y-4 p-5" aria-label="Chat color preview">
      <p className="text-center text-xs text-muted-foreground">Preview only</p>
      <div className="flex flex-col items-start gap-1">
        <p className="px-1 text-xs text-muted-foreground">Another player</p>
        <p className={`${incomingBubble} chat-tail-left max-w-[85%] rounded-[18px] px-3.5 py-2.5 text-sm`}>Who’s joining open play today?</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <p className="px-1 text-xs text-muted-foreground">You</p>
        <p className={`${outgoingBubble} chat-tail-right max-w-[85%] rounded-[18px] px-3.5 py-2.5 text-sm`}>I’ll see you on the courts!</p>
      </div>
    </div>
  </VenueTheme>;
}
