import { useRef, useState } from 'react';
import { FolderOpen, Upload, File, FileText, Image, Trash2, ExternalLink, Grid3X3, List } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { GroupEmptyState } from './GroupEmptyState';
import { ImageLightbox } from './ImageLightbox';
import { useGroupFiles, type GroupFile } from '@/hooks/useGroupFiles';
import { cn } from '@/lib/utils';

interface GroupFilesProps {
  groupId: string;
  isAdmin: boolean;
  currentUserId: string | null;
}

const FILE_ICONS: Record<string, any> = {
  'application/pdf': FileText,
  'image/jpeg': Image,
  'image/png': Image,
  'image/gif': Image,
  'image/webp': Image,
  default: File,
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ViewMode = 'list' | 'grid';

export function GroupFiles({ groupId, isAdmin, currentUserId }: GroupFilesProps) {
  const { files, loading, uploading, uploadFile, deleteFile } = useGroupFiles(groupId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Separate images and other files for gallery view
  const imageFiles = files.filter(f => f.file_type?.startsWith('image/'));
  const otherFiles = files.filter(f => !f.file_type?.startsWith('image/'));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Upload and View Toggle - Responsive */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
        <Button 
          onClick={() => fileInputRef.current?.click()} 
          className="gap-2 w-full sm:flex-1"
          disabled={uploading}
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading...' : 'Upload File'}
        </Button>
        
        {files.length > 0 && (
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(v) => v && setViewMode(v as ViewMode)}
            className="border rounded-lg self-end sm:self-auto"
          >
            <ToggleGroupItem value="list" aria-label="List view" className="h-9 px-2.5 sm:px-3">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view" className="h-9 px-2.5 sm:px-3">
              <Grid3X3 className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      {/* Files Display */}
      {files.length === 0 ? (
        <GroupEmptyState
          icon={FolderOpen}
          title="No files yet"
          description="Share documents, images, or resources with your group."
          actions={[
            { label: 'Upload File', onClick: () => fileInputRef.current?.click(), icon: Upload },
          ]}
          size="sm"
        />
      ) : viewMode === 'grid' ? (
        <div className="space-y-4">
          {/* Image Gallery */}
          {imageFiles.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
                Photos ({imageFiles.length})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {imageFiles.map((file) => (
                  <GridImageItem
                    key={file.id}
                    file={file}
                    canDelete={currentUserId === file.uploader_id || isAdmin}
                    onDelete={() => deleteFile(file.id)}
                    onClick={() => setLightboxImage(file.file_url)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Other Files Grid */}
          {otherFiles.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
                Documents ({otherFiles.length})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {otherFiles.map((file) => (
                  <GridFileItem
                    key={file.id}
                    file={file}
                    canDelete={currentUserId === file.uploader_id || isAdmin}
                    onDelete={() => deleteFile(file.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => {
            const isUploader = currentUserId === file.uploader_id;
            const canDelete = isUploader || isAdmin;
            const FileIcon = FILE_ICONS[file.file_type || ''] || FILE_ICONS.default;
            const isImage = file.file_type?.startsWith('image/');
            const initials = (file.uploader_profile?.display_name || file.uploader_profile?.full_name || 'U')
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <Card key={file.id} className="hover:bg-muted/30 transition-colors">
                <CardContent className="flex items-center gap-3 py-3">
                  {/* File Icon or Thumbnail */}
                  <div 
                    className={cn(
                      "h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden",
                      isImage && "cursor-pointer hover:opacity-80 transition-opacity"
                    )}
                    onClick={isImage ? () => setLightboxImage(file.file_url) : undefined}
                  >
                    {isImage ? (
                      <img 
                        src={file.file_url} 
                        alt={file.file_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* File Info - Responsive */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{file.file_name}</p>
                    <div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span className="hidden sm:inline">•</span>
                      <div className="hidden sm:flex items-center gap-1">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={file.uploader_profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[80px]">
                          {file.uploader_profile?.display_name || file.uploader_profile?.full_name || 'Unknown'}
                        </span>
                      </div>
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline">{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(file.file_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteFile(file.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Image Lightbox */}
      <ImageLightbox
        src={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}

// Grid item for images
interface GridImageItemProps {
  file: GroupFile;
  canDelete: boolean;
  onDelete: () => void;
  onClick: () => void;
}

function GridImageItem({ file, canDelete, onDelete, onClick }: GridImageItemProps) {
  return (
    <div className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
      <img
        src={file.file_url}
        alt={file.file_name}
        className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
        onClick={onClick}
      />
      {canDelete && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// Grid item for other files
interface GridFileItemProps {
  file: GroupFile;
  canDelete: boolean;
  onDelete: () => void;
}

function GridFileItem({ file, canDelete, onDelete }: GridFileItemProps) {
  const FileIcon = FILE_ICONS[file.file_type || ''] || FILE_ICONS.default;
  
  return (
    <div 
      className="relative group aspect-square rounded-lg overflow-hidden bg-muted/50 border border-border/30 p-2 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
      onClick={() => window.open(file.file_url, '_blank')}
    >
      <FileIcon className="h-8 w-8 text-muted-foreground mb-1" />
      <p className="text-[10px] text-center text-muted-foreground truncate w-full px-1">
        {file.file_name}
      </p>
      {canDelete && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
