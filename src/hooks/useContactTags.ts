import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContactTag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ContactTagAssignment {
  id: string;
  contact_id: string;
  tag_id: string;
  created_at: string;
}

export function useContactTags() {
  const [tags, setTags] = useState<ContactTag[]>([]);
  const [assignments, setAssignments] = useState<ContactTagAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    const [tagsRes, assignRes] = await Promise.all([
      supabase.from('contact_tags').select('*').order('name'),
      supabase.from('contact_tag_assignments').select('*'),
    ]);
    if (!tagsRes.error) setTags(tagsRes.data as unknown as ContactTag[]);
    if (!assignRes.error) setAssignments(assignRes.data as unknown as ContactTagAssignment[]);
    setLoading(false);
  }, []);

  const createTag = useCallback(async (name: string, color: string) => {
    const { error } = await supabase.from('contact_tags').insert({ name, color });
    if (error) { toast.error('Erro ao criar tag'); return; }
    toast.success('Tag criada');
    await fetchTags();
  }, [fetchTags]);

  const deleteTag = useCallback(async (id: string) => {
    await supabase.from('contact_tags').delete().eq('id', id);
    await fetchTags();
  }, [fetchTags]);

  const assignTag = useCallback(async (contactId: string, tagId: string) => {
    const { error } = await supabase.from('contact_tag_assignments').insert({ contact_id: contactId, tag_id: tagId });
    if (!error) await fetchTags();
  }, [fetchTags]);

  const removeTag = useCallback(async (contactId: string, tagId: string) => {
    await supabase.from('contact_tag_assignments').delete().eq('contact_id', contactId).eq('tag_id', tagId);
    await fetchTags();
  }, [fetchTags]);

  const getTagsForContact = useCallback((contactId: string) => {
    const tagIds = assignments.filter(a => a.contact_id === contactId).map(a => a.tag_id);
    return tags.filter(t => tagIds.includes(t.id));
  }, [assignments, tags]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  return { tags, assignments, loading, createTag, deleteTag, assignTag, removeTag, getTagsForContact, fetchTags };
}
