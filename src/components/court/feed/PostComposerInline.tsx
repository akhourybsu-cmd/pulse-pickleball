import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Clock, Users, Send, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PostComposerInlineProps {
  courtId: string;
  currentUserId: string | null;
  currentTab: string;
  placeholder: string;
  onPostCreated: () => void;
}

export const PostComposerInline = ({ 
  courtId, 
  currentUserId, 
  currentTab, 
  placeholder, 
  onPostCreated 
}: PostComposerInlineProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [lfgFormat, setLfgFormat] = useState<string>("doubles");
  const [loading, setLoading] = useState(false);

  // Map current tab to post type
  const getPostType = () => {
    switch (currentTab) {
      case "lfg": return "lfg";
      case "highlights": return "highlight";
      default: return "feed";
    }
  };

  const handleFocus = () => {
    if (!currentUserId) {
      toast.error("Please sign up to post", {
        action: {
          label: "Join Pulse",
          onClick: () => navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`),
        },
      });
      return;
    }
    setExpanded(true);
  };

  const handleCancel = () => {
    setExpanded(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setSessionDate("");
    setSessionTime("");
    setMaxPlayers("4");
    setLfgFormat("doubles");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;
    
    setLoading(true);

    try {
      const postType = getPostType();
      
      const postData: any = {
        court_id: courtId,
        user_id: currentUserId,
        title,
        content: body,
        status: "open",
        type: postType,
      };

      // Add LFG-specific fields
      if (postType === "lfg") {
        postData.session_date = sessionDate;
        postData.session_time = sessionTime;
        postData.max_players = parseInt(maxPlayers);
        postData.lfg_format = lfgFormat;
        
        // Set expiration to session date/time
        if (sessionDate && sessionTime) {
          const expiresAt = new Date(`${sessionDate}T${sessionTime}`);
          postData.expires_at = expiresAt.toISOString();
        }
      }

      const { error } = await supabase.from("court_posts").insert(postData);

      if (error) throw error;

      toast.success("Post created!");
      onPostCreated();
      handleCancel();
    } catch (error: any) {
      console.error("Error creating post:", error);
      toast.error(error.message || "Failed to create post");
    } finally {
      setLoading(false);
    }
  };

  const isLFG = currentTab === "lfg";

  return (
    <Card className="border-dashed border-2 border-muted-foreground/20">
      <CardContent className="pt-4">
        <AnimatePresence mode="wait">
          {!expanded ? (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Input
                placeholder={placeholder}
                onFocus={handleFocus}
                readOnly
                className="cursor-pointer bg-muted/50 border-none"
              />
            </motion.div>
          ) : (
            <motion.form
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="inline-title">Title</Label>
                <Input
                  id="inline-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    isLFG ? "e.g., Need 2 for doubles tonight" : "Give your post a title..."
                  }
                  required
                  autoFocus
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <Label htmlFor="inline-body">Details</Label>
                <Textarea
                  id="inline-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={
                    isLFG 
                      ? "Any skill level requirements? What time works?" 
                      : "Share more details..."
                  }
                  rows={3}
                  required
                />
              </div>

              {/* LFG-specific fields */}
              {isLFG && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold text-sm">Game Details</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="inline-date" className="flex items-center gap-2 text-xs">
                        <Calendar className="w-3 h-3" />
                        Date
                      </Label>
                      <Input
                        id="inline-date"
                        type="date"
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                        required
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="inline-time" className="flex items-center gap-2 text-xs">
                        <Clock className="w-3 h-3" />
                        Time
                      </Label>
                      <Input
                        id="inline-time"
                        type="time"
                        value={sessionTime}
                        onChange={(e) => setSessionTime(e.target.value)}
                        required
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs">
                        <Users className="w-3 h-3" />
                        Players Needed
                      </Label>
                      <Select value={maxPlayers} onValueChange={setMaxPlayers}>
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 player</SelectItem>
                          <SelectItem value="2">2 players</SelectItem>
                          <SelectItem value="3">3 players</SelectItem>
                          <SelectItem value="4">4 players</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Format</Label>
                      <Select value={lfgFormat} onValueChange={setLfgFormat}>
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="singles">Singles</SelectItem>
                          <SelectItem value="doubles">Doubles</SelectItem>
                          <SelectItem value="either">Either</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading}>
                  <Send className="w-4 h-4 mr-1" />
                  {loading ? "Posting..." : "Post"}
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};