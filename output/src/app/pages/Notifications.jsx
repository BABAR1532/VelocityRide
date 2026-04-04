import { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CheckCheck, Car, Package, CreditCard, AlertCircle, Bell, Loader, RefreshCw } from 'lucide-react';
import { notificationAPI } from '../services/api';
import {
  getLocalNotificationsForCurrentUser,
  markAllLocalAsReadForCurrentUser,
  markLocalAsRead,
} from '../services/localNotifications';

const getIcon = (type) => {
  switch (type) {
    case 'ride':    return Car;
    case 'delivery':return Package;
    case 'payment': return CreditCard;
    default:        return Bell;
  }
};

const getIconColor = (type) => {
  switch (type) {
    case 'ride':     return 'text-primary bg-primary/10';
    case 'delivery': return 'text-blue-600 bg-blue-600/10';
    case 'payment':  return 'text-green-600 bg-green-600/10';
    default:         return 'text-orange-600 bg-orange-600/10';
  }
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (hours < 1)  return `${mins}m ago`;
  if (days < 1)   return `${hours}h ago`;
  return `${days}d ago`;
}

export function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await notificationAPI.getNotifications();
      const apiNotifications = data.notifications || [];
      const localNotifications = getLocalNotificationsForCurrentUser();

      // If same message/title already arrived from backend, hide duplicate local copy.
      const dedupedLocal = localNotifications.filter((ln) => {
        return !apiNotifications.some(
          (an) => an.title === ln.title && an.message === ln.message
        );
      });

      const merged = [...apiNotifications, ...dedupedLocal].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setNotifications(merged);
    } catch (err) {
      // Even if backend notification service is unavailable, still show local notifications.
      const localNotifications = getLocalNotificationsForCurrentUser();
      setNotifications(localNotifications);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleMarkRead = async (id) => {
    if (String(id).startsWith('local-')) {
      markLocalAsRead(id);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, read: true } : n)
      );
      return;
    }
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, read: true } : n)
      );
    } catch { /* minor — ignore */ }
  };

  const handleMarkAllRead = async () => {
    markAllLocalAsReadForCurrentUser();
    try {
      await notificationAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      // If backend call fails, still keep local notifications marked read.
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setError(err.message);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <PageContainer
      title="Notifications"
      subtitle={loading ? 'Loading…' : `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
      action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchNotifications} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllRead}>
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All as Read
            </Button>
          )}
        </div>
      }
    >
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 text-destructive rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {loading ? (
        <Card>
          <CardBody className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader className="w-6 h-6 animate-spin" /> Loading notifications…
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const Icon = getIcon(notification.type);
            const iconColor = getIconColor(notification.type);
            return (
              <Card
                key={notification._id}
                className={!notification.read ? 'border-l-4 border-l-primary cursor-pointer' : 'cursor-pointer'}
                onClick={() => !notification.read && handleMarkRead(notification._id)}
              >
                <CardBody>
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="font-semibold text-foreground">
                          {notification.title}
                          {!notification.read && (
                            <span className="ml-2 inline-block w-2 h-2 bg-primary rounded-full" />
                          )}
                        </h3>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {timeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{notification.message}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}

          {notifications.length === 0 && (
            <Card>
              <CardBody className="text-center py-12">
                <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No notifications yet</p>
                <p className="text-sm text-muted-foreground mt-1">Notifications appear here after bookings, deliveries, and more.</p>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
}
