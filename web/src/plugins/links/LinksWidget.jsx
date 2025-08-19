import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Avatar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { retryingJson } from '../../lib/retryFetch.js';

// Supports groups: [{ label?, items: [{label?, url, icon?}] }]; falls back to flat items[] if groups not provided
export default function LinksWidget({ items = [], groups = [], allowEdit = true, onChangePropsPersist, refreshSignal, wid }) {
  const hasGroups = Array.isArray(groups) && groups.length > 0;
  const [stateGroups, setStateGroups] = useState(
    hasGroups ? groups.map(g => ({ label: g.label || null, items: Array.isArray(g.items) ? g.items : [] }))
              : [{ label: null, items: items || [] }]
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { label,url,icon,index,groupIndex }
  const [error, setError] = useState(null);
  const [locked, setLocked] = useState(true);
  const defaultGroupIndex = 0;

  useEffect(() => {
    const next = (Array.isArray(groups) && groups.length > 0)
      ? groups.map(g => ({ label: g.label || null, items: Array.isArray(g.items) ? g.items : [] }))
      : [{ label: null, items: items || [] }];
    setStateGroups(next);
  }, [JSON.stringify(groups || []), JSON.stringify(items || [])]);

  useEffect(() => {
    const addHandler = (e) => {
      if (e?.detail?.wid && e.detail.wid !== wid) return;
      setEditing({ label: '', url: '', icon: '', groupIndex: defaultGroupIndex }); setOpen(true);
    };
    const lockHandler = (e) => {
      if (e?.detail?.wid && e.detail.wid !== wid) return;
      setLocked(Boolean(e?.detail?.locked));
    };
    window.addEventListener('links:add', addHandler);
    window.addEventListener('links:lock', lockHandler);
    return () => {
      window.removeEventListener('links:add', addHandler);
      window.removeEventListener('links:lock', lockHandler);
    };
  }, [wid]);

  function persist(nextGroups) {
    if (hasGroups) onChangePropsPersist && onChangePropsPersist({ groups: nextGroups });
    else onChangePropsPersist && onChangePropsPersist({ items: nextGroups[0]?.items || [] });
  }

  function upsert(item, index = null, groupIndex = defaultGroupIndex) {
    setStateGroups(prev => {
      const copy = prev.map(g => ({ ...g, items: [...g.items] }));
      if (!copy[groupIndex]) copy[groupIndex] = { label: null, items: [] };
      if (index == null || index < 0) copy[groupIndex].items.push(item);
      else copy[groupIndex].items.splice(index, 1, item);
      persist(copy);
      return copy;
    });
  }
  function remove(index, groupIndex = defaultGroupIndex) {
    setStateGroups(prev => {
      const copy = prev.map(g => ({ ...g, items: [...g.items] }));
      if (!copy[groupIndex]) return prev;
      copy[groupIndex].items = copy[groupIndex].items.filter((_, i) => i !== index);
      persist(copy);
      return copy;
    });
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      {stateGroups.map((group, gi) => (
        <Box key={gi} sx={{ mb: 1 }}>
          {group.label && (
            <Typography variant="caption" sx={{ color: 'rgba(200,210,230,0.7)', ml: 0.5 }}>{group.label}</Typography>
          )}
          <Grid container spacing={1}>
            {group.items.map((link, i) => (
              <Grid key={i} item xs={2} sm={2} md={2} lg={2}>
                <Stack component="a" href={link.url} target="_blank" rel="noreferrer"
                  direction="row" spacing={1} alignItems="center"
                  sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, textDecoration: 'none', color: 'inherit', transition: 'background-color 120ms ease', '&:hover': { bgcolor: 'rgba(144,202,249,0.12)' } }}>
                  <Avatar src={link.icon} alt={link.label} sx={{ width: 28, height: 28 }}>{link.label?.[0]?.toUpperCase()}</Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Tooltip title={link.url}>
                      <Typography variant="body2" noWrap sx={{ color: 'rgba(200, 210, 230, 0.85)' }}>
                        {link.label || link.url}
                      </Typography>
                    </Tooltip>
                  </Box>
                  {allowEdit && !locked && (
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing({ ...link, index: i, groupIndex: gi }); setOpen(true); }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(i, gi); }}><DeleteIcon fontSize="small" /></IconButton>
                    </Stack>
                  )}
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing?.index != null ? 'Edit Link' : 'Add Link'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Label" size="small" value={editing?.label || ''} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
            <TextField label="URL" size="small" value={editing?.url || ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} />
            <TextField label="Icon URL" size="small" value={editing?.icon || ''} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => {
            if (!editing?.url) return setError('URL is required');
            const payload = { label: editing.label?.trim() || editing.url, url: editing.url.trim(), icon: editing.icon?.trim() || '' };
            upsert(payload, editing?.index, editing?.groupIndex ?? defaultGroupIndex);
            setOpen(false); setEditing(null);
          }}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

