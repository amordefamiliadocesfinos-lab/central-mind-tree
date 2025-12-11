import { useState, useEffect, useCallback } from 'react';

const PERMISSION_KEY = 'pc.notifications.permission';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('Notification' in window);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      localStorage.setItem(PERMISSION_KEY, result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const notify = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      // Fallback: show in-app notification via toast
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }, [isSupported, permission]);

  const scheduleNotification = useCallback((
    title: string,
    delayMs: number,
    options?: NotificationOptions
  ) => {
    const timeoutId = setTimeout(() => {
      if (document.hidden) {
        notify(title, options);
      } else {
        // In-app: dispatch custom event for banner
        window.dispatchEvent(new CustomEvent('routine-alert', { 
          detail: { title, ...options } 
        }));
      }
    }, delayMs);

    return timeoutId;
  }, [notify]);

  return {
    permission,
    isSupported,
    requestPermission,
    notify,
    scheduleNotification,
  };
}
