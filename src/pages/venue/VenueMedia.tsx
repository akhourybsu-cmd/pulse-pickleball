import { useState } from 'react';
import { useMode } from '@/contexts/ModeContext';
import { useVenueMedia, VenueMediaItem } from '@/hooks/useVenueMedia';
import { useVenueTheme } from '@/components/layout/VenueShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Image, Trash2, Star, Edit2, X, GripVertical } from 'lucide-react';

export default function VenueMedia() {
  const { currentVenueId } = useMode();
  const { media, loading, saving, addMedia, updateMedia, deleteMedia, reorderMedia } = useVenueMedia(currentVenueId);
  const venueTheme = useVenueTheme();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaCaption, setNewMediaCaption] = useState('');
  const [editingItem, setEditingItem] = useState<VenueMediaItem | null>(null);
  const [editCaption, setEditCaption] = useState('');

  const handleAddMedia = async () => {
    if (!newMediaUrl.trim()) return;
    
    const result = await addMedia(newMediaUrl.trim(), newMediaCaption.trim());
    if (result) {
      setNewMediaUrl('');
      setNewMediaCaption('');
      setShowAddDialog(false);
    }
  };

  const handleUpdateCaption = async () => {
    if (!editingItem) return;
    
    await updateMedia(editingItem.id, { caption: editCaption });
    setEditingItem(null);
    setEditCaption('');
  };

  const handleSetFeatured = async (item: VenueMediaItem) => {
    // Move this item to the front by setting sort_order to -1, then reorder
    const orderedIds = [item.id, ...media.filter(m => m.id !== item.id).map(m => m.id)];
    await reorderMedia(orderedIds);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this photo?')) {
      await deleteMedia(id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Media Gallery</h1>
          <p className="text-muted-foreground">Photos of your venue and courts</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button
              style={{ backgroundColor: venueTheme.primary }}
              className="hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Photo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Photo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input
                  value={newMediaUrl}
                  onChange={(e) => setNewMediaUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              {newMediaUrl && (
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  <img 
                    src={newMediaUrl} 
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Caption (optional)</Label>
                <Input
                  value={newMediaCaption}
                  onChange={(e) => setNewMediaCaption(e.target.value)}
                  placeholder="Describe this photo..."
                />
              </div>
              <Button 
                onClick={handleAddMedia}
                disabled={!newMediaUrl.trim() || saving}
                className="w-full"
                style={{ backgroundColor: venueTheme.primary }}
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Add Photo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {media.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Image className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No photos yet</h3>
            <p className="text-muted-foreground mb-4">
              Add photos to make your venue page feel real and help players know what to expect.
            </p>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add your first photo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item, index) => (
            <Card key={item.id} className="overflow-hidden group">
              <div className="relative aspect-video bg-muted">
                <img 
                  src={item.media_url} 
                  alt={item.caption || 'Venue photo'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400&h=300&fit=crop';
                  }}
                />
                {index === 0 && (
                  <div 
                    className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: venueTheme.primary }}
                  >
                    <Star className="h-3 w-3 inline mr-1" />
                    Featured
                  </div>
                )}
                
                {/* Action overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {index !== 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSetFeatured(item)}
                      disabled={saving}
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Feature
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditingItem(item);
                      setEditCaption(item.caption || '');
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(item.id)}
                    disabled={saving}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {item.caption && (
                <CardContent className="p-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.caption}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Edit Caption Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Caption</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingItem && (
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                <img 
                  src={editingItem.media_url} 
                  alt="Photo"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Caption</Label>
              <Input
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="Describe this photo..."
              />
            </div>
            <Button 
              onClick={handleUpdateCaption}
              disabled={saving}
              className="w-full"
              style={{ backgroundColor: venueTheme.primary }}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Caption
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
