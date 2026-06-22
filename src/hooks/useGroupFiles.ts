import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GroupFile {
  id: string;
  group_id: string;
  uploader_id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  uploader_profile?: {
    display_name: string | null;
    full_name: string;
    avatar_url: string | null;
  };
}

export function useGroupFiles(groupId: string | undefined) {
  const [files, setFiles] = useState<GroupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const fetchFiles = useCallback(async () => {
    if (!groupId) return;
    
    setLoading(true);
    try {
      const { data: filesData, error } = await supabase
        .from('group_files')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch uploader profiles
      const uploaderIds = [...new Set((filesData || []).map(f => f.uploader_id))];
      const { data: profilesData } = await supabase
        .from('profiles_public')
        .select('id, display_name, full_name, avatar_url')
        .in('id', uploaderIds);

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

      const filesWithData: GroupFile[] = (filesData || []).map(f => ({
        ...f,
        uploader_profile: profilesMap.get(f.uploader_id),
      }));

      setFiles(filesWithData);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load files',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const uploadFile = async (file: File) => {
    if (!groupId) return null;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${groupId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('group-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('group-files')
        .getPublicUrl(fileName);

      // Create file record
      const { data, error } = await supabase
        .from('group_files')
        .insert({
          group_id: groupId,
          uploader_id: user.id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Uploaded!', description: `${file.name} has been uploaded` });
      await fetchFiles();
      return data;
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('group_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      toast({ title: 'Deleted', description: 'File has been removed' });
      await fetchFiles();
      return true;
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete file',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    files,
    loading,
    uploading,
    uploadFile,
    deleteFile,
    refetch: fetchFiles,
  };
}
