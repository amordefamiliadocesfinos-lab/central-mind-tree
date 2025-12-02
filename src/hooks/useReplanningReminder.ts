import { useState, useEffect } from "react";
import { startOfWeek } from "date-fns";

const getWeekStartTimestamp = () => {
  return startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();
};

const getTodayISO = () => {
  return new Date().toISOString().split("T")[0];
};

export const useReplanningReminder = () => {
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    const checkReminder = () => {
      // Test mode: localStorage.setItem("pc.plan.testBanner", "true")
      const testMode = localStorage.getItem("pc.plan.testBanner") === "true";
      
      if (!testMode) {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, 5=Friday
        const hour = now.getHours();

        // Check if it's Friday after 16:00 or Monday between 08:00-12:00
        const isFridayAfternoon = dayOfWeek === 5 && hour >= 16;
        const isMondayMorning = dayOfWeek === 1 && hour >= 8 && hour < 12;

        if (!isFridayAfternoon && !isMondayMorning) {
          setShowReminder(false);
          return;
        }
      }

      // Check if planning was completed this week
      const lastCompletedAt = localStorage.getItem("pc.plan.lastCompletedAt");
      const weekStart = getWeekStartTimestamp();

      if (lastCompletedAt && parseInt(lastCompletedAt) >= weekStart) {
        setShowReminder(false);
        return;
      }

      // Check if snoozed today
      const snoozeUntil = localStorage.getItem("pc.plan.snoozeUntil");
      const today = getTodayISO();

      if (snoozeUntil && snoozeUntil >= today) {
        setShowReminder(false);
        return;
      }

      setShowReminder(true);
    };

    checkReminder();
    // Check every minute in case time conditions change
    const interval = setInterval(checkReminder, 60000);
    return () => clearInterval(interval);
  }, []);

  const snoozeToday = () => {
    localStorage.setItem("pc.plan.snoozeUntil", getTodayISO());
    setShowReminder(false);
  };

  return { showReminder, snoozeToday };
};
