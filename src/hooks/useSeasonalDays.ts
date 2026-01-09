import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SeasonalDay {
  id: string;
  name: string;
  color: string;
  importance: number;
  recurrence_type: 'fixed' | 'nth_weekday' | 'range';
  month: number | null;
  day: number | null;
  end_month: number | null;
  end_day: number | null;
  nth_occurrence: number | null;
  weekday: number | null;
  prep_days: number;
  reminders: string[];
  auto_tasks: boolean;
  auto_task_templates: { title: string; status: string }[];
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SeasonalOccurrence {
  seasonalDay: SeasonalDay;
  date: string;
  endDate?: string;
  isRange: boolean;
  isPrepDay: boolean;
  prepDaysRemaining?: number;
}

export const useSeasonalDays = () => {
  const [seasonalDays, setSeasonalDays] = useState<SeasonalDay[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSeasonalDays = useCallback(async () => {
    const { data, error } = await supabase
      .from('seasonal_days')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching seasonal days:', error);
      return;
    }

    setSeasonalDays(
      (data || []).map((d) => ({
        ...d,
        recurrence_type: d.recurrence_type as SeasonalDay['recurrence_type'],
        reminders: (d.reminders as string[]) || [],
        auto_task_templates: (d.auto_task_templates as SeasonalDay['auto_task_templates']) || [],
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSeasonalDays();

    const channel = supabase
      .channel('seasonal_days_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seasonal_days' },
        () => fetchSeasonalDays()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSeasonalDays]);

  const createSeasonalDay = async (
    data: Omit<SeasonalDay, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SeasonalDay | null> => {
    const { data: created, error } = await supabase
      .from('seasonal_days')
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error('Error creating seasonal day:', error);
      return null;
    }

    return {
      ...created,
      recurrence_type: created.recurrence_type as SeasonalDay['recurrence_type'],
      reminders: (created.reminders as string[]) || [],
      auto_task_templates: (created.auto_task_templates as SeasonalDay['auto_task_templates']) || [],
    };
  };

  const updateSeasonalDay = async (
    id: string,
    updates: Partial<SeasonalDay>
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('seasonal_days')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating seasonal day:', error);
      return false;
    }
    return true;
  };

  const deleteSeasonalDay = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('seasonal_days')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting seasonal day:', error);
      return false;
    }
    return true;
  };

  // Calculate Nth weekday of month (e.g., 2nd Monday of November)
  const getNthWeekdayOfMonth = (
    year: number,
    month: number,
    weekday: number,
    nth: number
  ): number | null => {
    if (nth === 0) return null;

    const firstDay = new Date(year, month - 1, 1);
    const firstWeekday = firstDay.getDay();
    let day = 1 + ((weekday - firstWeekday + 7) % 7);

    if (nth > 0) {
      day += (nth - 1) * 7;
    } else {
      // Last occurrence
      const lastDay = new Date(year, month, 0).getDate();
      day = lastDay - ((new Date(year, month - 1, lastDay).getDay() - weekday + 7) % 7);
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) return null;
    return day;
  };

  // Get occurrences for a specific year
  const getOccurrencesForYear = useCallback(
    (year: number): SeasonalOccurrence[] => {
      const occurrences: SeasonalOccurrence[] = [];

      seasonalDays.forEach((sd) => {
        if (sd.recurrence_type === 'fixed' && sd.month && sd.day) {
          const dateStr = `${year}-${String(sd.month).padStart(2, '0')}-${String(sd.day).padStart(2, '0')}`;
          occurrences.push({
            seasonalDay: sd,
            date: dateStr,
            isRange: false,
            isPrepDay: false,
          });

          // Add prep days
          if (sd.prep_days > 0) {
            for (let i = 1; i <= sd.prep_days; i++) {
              const prepDate = new Date(year, sd.month - 1, sd.day - i);
              const prepDateStr = `${prepDate.getFullYear()}-${String(prepDate.getMonth() + 1).padStart(2, '0')}-${String(prepDate.getDate()).padStart(2, '0')}`;
              occurrences.push({
                seasonalDay: sd,
                date: prepDateStr,
                isRange: false,
                isPrepDay: true,
                prepDaysRemaining: i,
              });
            }
          }
        } else if (sd.recurrence_type === 'nth_weekday' && sd.month && sd.nth_occurrence !== null && sd.weekday !== null) {
          const day = getNthWeekdayOfMonth(year, sd.month, sd.weekday, sd.nth_occurrence);
          if (day) {
            const dateStr = `${year}-${String(sd.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            occurrences.push({
              seasonalDay: sd,
              date: dateStr,
              isRange: false,
              isPrepDay: false,
            });

            // Add prep days
            if (sd.prep_days > 0) {
              for (let i = 1; i <= sd.prep_days; i++) {
                const prepDate = new Date(year, sd.month - 1, day - i);
                const prepDateStr = `${prepDate.getFullYear()}-${String(prepDate.getMonth() + 1).padStart(2, '0')}-${String(prepDate.getDate()).padStart(2, '0')}`;
                occurrences.push({
                  seasonalDay: sd,
                  date: prepDateStr,
                  isRange: false,
                  isPrepDay: true,
                  prepDaysRemaining: i,
                });
              }
            }
          }
        } else if (sd.recurrence_type === 'range' && sd.month && sd.day && sd.end_month && sd.end_day) {
          const startDate = new Date(year, sd.month - 1, sd.day);
          let endDate = new Date(year, sd.end_month - 1, sd.end_day);
          
          // Handle year wrap (e.g., Dec 25 to Jan 2)
          if (endDate < startDate) {
            endDate = new Date(year + 1, sd.end_month - 1, sd.end_day);
          }

          const startStr = `${year}-${String(sd.month).padStart(2, '0')}-${String(sd.day).padStart(2, '0')}`;
          const endStr = `${endDate.getFullYear()}-${String(sd.end_month).padStart(2, '0')}-${String(sd.end_day).padStart(2, '0')}`;

          occurrences.push({
            seasonalDay: sd,
            date: startStr,
            endDate: endStr,
            isRange: true,
            isPrepDay: false,
          });

          // Add prep days before range starts
          if (sd.prep_days > 0) {
            for (let i = 1; i <= sd.prep_days; i++) {
              const prepDate = new Date(year, sd.month - 1, sd.day - i);
              const prepDateStr = `${prepDate.getFullYear()}-${String(prepDate.getMonth() + 1).padStart(2, '0')}-${String(prepDate.getDate()).padStart(2, '0')}`;
              occurrences.push({
                seasonalDay: sd,
                date: prepDateStr,
                isRange: false,
                isPrepDay: true,
                prepDaysRemaining: i,
              });
            }
          }
        }
      });

      return occurrences;
    },
    [seasonalDays]
  );

  // Check if a date falls within a range occurrence
  const isDateInRange = (dateStr: string, occurrence: SeasonalOccurrence): boolean => {
    if (!occurrence.isRange || !occurrence.endDate) return dateStr === occurrence.date;
    return dateStr >= occurrence.date && dateStr <= occurrence.endDate;
  };

  // Get occurrences for a specific date
  const getOccurrencesForDate = useCallback(
    (dateStr: string): SeasonalOccurrence[] => {
      const year = parseInt(dateStr.split('-')[0]);
      const allOccurrences = getOccurrencesForYear(year);
      
      return allOccurrences.filter((occ) => {
        if (occ.isRange) {
          return isDateInRange(dateStr, occ);
        }
        return occ.date === dateStr;
      });
    },
    [getOccurrencesForYear]
  );

  return {
    seasonalDays,
    loading,
    createSeasonalDay,
    updateSeasonalDay,
    deleteSeasonalDay,
    getOccurrencesForYear,
    getOccurrencesForDate,
    refetch: fetchSeasonalDays,
  };
};
