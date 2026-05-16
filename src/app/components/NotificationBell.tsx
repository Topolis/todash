// ABOUTME: Bell icon with badge and notification dialog for the dashboard header.
// Polls the server for active notifications and allows dismissing them.

import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  Tooltip,
  Typography,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import CloseIcon from '@mui/icons-material/Close';
import BugReportIcon from '@mui/icons-material/BugReport';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import Markdown from 'react-markdown';
import type { Notification, NotificationSeverity } from '@types/notification';

const POLL_INTERVAL_MS = 30_000;

const isDev = window.location.port === '5173';
const apiBase = isDev ? 'http://localhost:4000' : '';

function severityIcon(severity: NotificationSeverity) {
  switch (severity) {
    case 'debug':
      return <BugReportIcon sx={{ color: 'text.secondary' }} fontSize="small" />;
    case 'info':
      return <InfoIcon sx={{ color: 'info.main' }} fontSize="small" />;
    case 'warn':
      return <WarningIcon sx={{ color: 'warning.main' }} fontSize="small" />;
    case 'error':
      return <ErrorIcon sx={{ color: 'error.main' }} fontSize="small" />;
  }
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/notifications`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch {
      // silently ignore network errors — don't spam the user
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function dismiss(id: string) {
    try {
      await fetch(`${apiBase}/api/notifications/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // retry on next poll
    }
  }

  async function dismissAll() {
    try {
      await fetch(`${apiBase}/api/notifications`, { method: 'DELETE' });
      setNotifications([]);
    } catch {
      // retry on next poll
    }
  }

  const count = notifications.length;

  return (
    <>
      <Tooltip title={count > 0 ? `${count} notification${count === 1 ? '' : 's'}` : 'No notifications'}>
        <IconButton
          onClick={() => setOpen(true)}
          color={count > 0 ? 'default' : 'default'}
          aria-label="notifications"
        >
          <Badge
            badgeContent={count}
            color="error"
            max={99}
            invisible={count === 0}
          >
            {count > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { maxHeight: '70vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6">Notifications</Typography>
          <IconButton onClick={() => setOpen(false)} size="small" aria-label="close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 0 }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No notifications</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {notifications.map((n, idx) => (
                <React.Fragment key={n.id}>
                  {idx > 0 && <Divider />}
                  <ListItem
                    alignItems="flex-start"
                    sx={{ py: 1.5, px: 2, gap: 1 }}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        aria-label="dismiss"
                        onClick={() => dismiss(n.id)}
                        sx={{ mt: 0.5 }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, pr: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        {severityIcon(n.severity)}
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {n.origin}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
                          {formatTimestamp(n.timestamp)}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          '& p': { m: 0 },
                          '& p + p': { mt: 1 },
                          '& a': { color: 'primary.main' },
                          '& code': {
                            fontFamily: 'monospace',
                            fontSize: '0.85em',
                            background: 'rgba(255,255,255,0.08)',
                            px: 0.5,
                            borderRadius: 0.5,
                          },
                          fontSize: '0.875rem',
                          lineHeight: 1.5,
                        }}
                      >
                        <Markdown>{n.message}</Markdown>
                      </Box>
                    </Box>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>

        {notifications.length > 0 && (
          <>
            <Divider />
            <DialogActions sx={{ px: 2, py: 1 }}>
              <Button onClick={dismissAll} size="small" color="inherit">
                Dismiss all
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
