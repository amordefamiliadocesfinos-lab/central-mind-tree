import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MediaFolder {
  id: string;
  name: string;
  color: string | null;
  order_index: number | null;
  created_at: string;
}

export function useMediaFolders() {
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFolders = useCallback(async () => {
    const { data, error } = await supabase
      .from('digital_media_folders')
      .select('*')
      .order('order_index', { ascending: true });

    if (!error && data) {
      setFolders(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const createFolder = async (name: string, color?: string) => {
    const maxOrder = folders.reduce((max, f) => Math.max(max, f.order_index || 0), 0);
    
    const { data, error } = await supabase
      .from('digital_media_folders')
      .insert({
        name,
        color: color || '#6366f1',
        order_index: maxOrder + 1
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar pasta');
      return null;
    }

    toast.success('Pasta criada!');
    await fetchFolders();
    return data;
  };

  const updateFolder = async (id: string, updates: Partial<Pick<MediaFolder, 'name' | 'color'>>) => {
    const { error } = await supabase
      .from('digital_media_folders')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar pasta');
      return false;
    }

    await fetchFolders();
    return true;
  };

  const deleteFolder = async (id: string) => {
    // First, move all media in this folder to "no folder"
    await supabase
      .from('digital_media')
      .update({ folder_id: null })
      .eq('folder_id', id);

    const { error } = await supabase
      .from('digital_media_folders')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir pasta');
      return false;
    }

    toast.success('Pasta excluída');
    await fetchFolders();
    return true;
  };

  const moveMediaToFolder = async (mediaId: string, folderId: string | null) => {
    const { error } = await supabase
      .from('digital_media')
      .update({ folder_id: folderId })
      .eq('id', mediaId);

    if (error) {
      toast.error('Erro ao mover mídia');
      return false;
    }

    return true;
  };

  const getMediaCountByFolder = async (folderId: string | null): Promise<number> => {
    let query = supabase
      .from('digital_media')
      .select('id', { count: 'exact' });

    if (folderId) {
      query = query.eq('folder_id', folderId);
    } else {
      query = query.is('folder_id', null);
    }

    const { count } = await query;
    return count || 0;
  };

  return {
    folders,
    loading,
    createFolder,
    updateFolder,
    deleteFolder,
    moveMediaToFolder,
    getMediaCountByFolder,
    refetch: fetchFolders
  };
}
