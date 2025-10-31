import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setLoading(true);
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
      .limit(100);

    if (data) {
      setMessages(data as any);
    }
    setLoading(false);
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
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 100);
  };

  const getDisplayName = (msg: Message) => {
    if (!msg.profiles) return "Unknown";
    return msg.profiles.display_name || msg.profiles.full_name;
  };

  const getInitials = (msg: Message) => {
    const name = getDisplayName(msg);
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const isOwnMessage = (msg: Message) => msg.user_id === userId;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] border rounded-lg bg-card">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground">No messages yet</p>
                  <p className="text-sm text-muted-foreground">Start the conversation!</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, index) => {
                  const isOwn = isOwnMessage(msg);
                  const showAvatar = index === 0 || messages[index - 1].user_id !== msg.user_id;
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {showAvatar ? (
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarFallback className="text-xs bg-primary/10">
                            {getInitials(msg)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8 flex-shrink-0" />
                      )}
                      
                      <div className={`flex-1 max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                        {showAvatar && (
                          <div className={`flex items-baseline gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className="font-semibold text-sm">{getDisplayName(msg)}</span>
                            <span className="text-xs text-muted-foreground">
                              {getTimeAgo(msg.created_at)}
                            </span>
                          </div>
                        )}
                        <div
                          className={`rounded-lg px-4 py-2 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={scrollRef} />
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {userId ? (
        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={sending}
              className="flex-1"
            />
            <Button 
              onClick={handleSend} 
              disabled={sending || !newMessage.trim()} 
              size="icon"
              className="flex-shrink-0"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t bg-muted text-center text-sm text-muted-foreground">
          Sign in to join the conversation
        </div>
      )}
    </div>
  );
}
