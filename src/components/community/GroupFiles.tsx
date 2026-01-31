import { useRef } from 'react';
import { FolderOpen, Upload, File, FileText, Image, Trash2, Download, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupEmptyState } from './GroupEmptyState';
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

export function GroupFiles({ groupId, isAdmin, currentUserId }: GroupFilesProps) {
  const { files, loading, uploading, uploadFile, deleteFile } = useGroupFiles(groupId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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
      {/* Upload Button */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
      />
      <Button 
        onClick={() => fileInputRef.current?.click()} 
        className="w-full gap-2"
        disabled={uploading}
      >
        <Upload className="h-4 w-4" />
        {uploading ? 'Uploading...' : 'Upload File'}
      </Button>

      {/* Files List */}
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
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
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

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{file.file_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={file.uploader_profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                        </Avatar>
                        {file.uploader_profile?.display_name || file.uploader_profile?.full_name || 'Unknown'}
                      </div>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}</span>
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
    </div>
  );
}
