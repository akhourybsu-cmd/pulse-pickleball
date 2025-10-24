import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { formatDateEST } from "@/lib/utils";

interface Message {
  id: number;
  body: string;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string;
    display_name: string | null;
  };
}

interface CourtChannelProps {
  courtId: string;
  userId: string | null;
}

export function CourtChannel({ courtId, userId }: CourtChannelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [channelId, setChannelId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchOrCreateChannel();
  }, [courtId]);

  useEffect(() => {
    if (channelId) {
      fetchMessages();
      subscribeToMessages();
    }
  }, [channelId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchOrCreateChannel = async () => {
    // Check if channel exists
    const { data: existing } = await (supabase as any)
      .from("court_channels")
      .select("id")
      .eq("court_id", courtId)
      .single();

    if (existing) {
      setChannelId(existing.id);
    } else {
      // Create channel
      const { data: newChannel } = await (supabase as any)
        .from("court_channels")
        .insert({ court_id: courtId })
        .select("id")
        .single();

      if (newChannel) {
        setChannelId(newChannel.id);
      }
    }
  };

  const fetchMessages = async () => {
    const { data } = await (supabase as any)
      .from("channel_messages")
      .select(`
        id,
        body,
        created_at,
        user_id,
        profiles:user_id (full_name, display_name)
      `)
      .eq("channel_id", channelId)
      .is("thread_id", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (data) {
      setMessages(data as any);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`court_channel_${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !userId || !channelId || sending) return;

    setSending(true);
    const { error } = await (supabase as any)
      .from("channel_messages")
      .insert({
        channel_id: channelId,
        user_id: userId,
        body: newMessage.trim(),
      });

    setSending(false);

    if (!error) {
      setNewMessage("");
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const getDisplayName = (msg: Message) => {
    if (!msg.profiles) return "Unknown";
    return msg.profiles.display_name || msg.profiles.full_name;
  };

  const getInitials = (msg: Message) => {
    const name = getDisplayName(msg);
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[400px] pr-4" ref={scrollRef as any}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs">
                    {getInitials(msg)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">{getDisplayName(msg)}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateEST(new Date(msg.created_at), "h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm">{msg.body}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {userId && (
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending || !newMessage.trim()} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
