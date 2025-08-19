import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, List, ListItem, ListItemText, Stack } from '@mui/material';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { retryingJson } from '../../lib/retryFetch.js';

export default function EmailWidget({ limit = 20, mailbox, host, port, secure, user, password }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState({ open: false, body: null, meta: null });

  function reload(force) {
    setLoading(true); setError(null);
    const body = { action: 'list', limit, mailbox, host, port, secure, user, password, force: !!force };
    retryingJson('/api/widget/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, { retries: 1, backoffMs: 500 })
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(true); }, [limit, mailbox, host, port, secure, user, password]);

  function markRead(uid) {
    retryingJson('/api/widget/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'markRead', uid, mailbox, host, port, secure, user, password }) }, { retries: 0 })
      .then(() => setItems(items => items.filter(it => it.uid !== uid)))
      .catch(e => setError(String(e)));
  }

  function openMail(uid) {
    retryingJson('/api/widget/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getBody', uid, mailbox, host, port, secure, user, password }) }, { retries: 0 })
      .then(({ data }) => setDialog({ open: true, body: data, meta: data }))
      .catch(e => setError(String(e)));
  }

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!items) return null;

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <List dense>
        {items.map(it => (
          <ListItem key={it.uid}
            secondaryAction={
              <Stack direction="row" spacing={1}>
                <IconButton onClick={() => openMail(it.uid)} title="Open"><OpenInNewIcon fontSize="small" /></IconButton>
                <IconButton onClick={() => markRead(it.uid)} title="Mark as read"><MarkEmailReadIcon fontSize="small" /></IconButton>
              </Stack>
            }
          >
            <ListItemText primary={it.subject} secondary={`${it.from} — ${new Date(it.date).toLocaleString()}`} />
          </ListItem>
        ))}
      </List>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false })} fullWidth maxWidth="md">
        <DialogTitle>{dialog.meta?.subject}</DialogTitle>
        <DialogContent dividers>
          {dialog.body?.html ? (
            <div dangerouslySetInnerHTML={{ __html: dialog.body.html }} />
          ) : (
            <DialogContentText sx={{ whiteSpace: 'pre-wrap' }}>{dialog.body?.text || 'No content'}</DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog({ open: false })}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

