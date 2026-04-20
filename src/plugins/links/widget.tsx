import React, { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SquareLink from './SquareLink';
import type { PluginWidgetProps } from '@types/plugin';
import type { LinksConfig, LinkItem, LinkGroup } from './data';

interface DragSource {
  groupIndex: number;
  index: number;
}

interface DropTarget {
  groupIndex: number;
  index: number;
}

export default function LinksWidget(props: PluginWidgetProps<LinksConfig>) {
  const {
    items = [],
    groups = [],
    allowEdit = true,
    onChangePropsPersist,
    refreshSignal,
    wid,
    layout = 'list',
    squareMin = 56,
    squareGap = 1,
  } = props;

  const hasGroups = Array.isArray(groups) && groups.length > 0;
  const [stateGroups, setStateGroups] = useState<LinkGroup[]>(
    hasGroups
      ? groups.map((g) => ({ label: g.label || undefined, items: Array.isArray(g.items) ? g.items : [] }))
      : [{ items: items || [] }]
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(LinkItem & { index?: number; groupIndex?: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const defaultGroupIndex = 0;

  useEffect(() => {
    const next =
      Array.isArray(groups) && groups.length > 0
        ? groups.map((g) => ({ label: g.label || undefined, items: Array.isArray(g.items) ? g.items : [] }))
        : [{ items: items || [] }];
    setStateGroups(next);
  }, [JSON.stringify(groups || []), JSON.stringify(items || [])]);

  useEffect(() => {
    const addHandler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent?.detail?.wid && customEvent.detail.wid !== wid) return;
      setEditing({ label: '', url: '', icon: '', groupIndex: defaultGroupIndex });
      setOpen(true);
    };
    const lockHandler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent?.detail?.wid && customEvent.detail.wid !== wid) return;
      setLocked(Boolean(customEvent?.detail?.locked));
    };
    window.addEventListener('links:add', addHandler);
    window.addEventListener('links:lock', lockHandler);
    return () => {
      window.removeEventListener('links:add', addHandler);
      window.removeEventListener('links:lock', lockHandler);
    };
  }, [wid]);

  function persist(nextGroups: LinkGroup[]) {
    if (hasGroups) {
      onChangePropsPersist?.({ groups: nextGroups });
    } else {
      onChangePropsPersist?.({ items: nextGroups[0]?.items || [] });
    }
  }

  function upsert(item: LinkItem, index: number | null = null, groupIndex = defaultGroupIndex) {
    setStateGroups((prev) => {
      const copy = prev.map((g) => ({ ...g, items: [...g.items] }));
      if (!copy[groupIndex]) copy[groupIndex] = { items: [] };
      if (index == null || index < 0) {
        copy[groupIndex].items.push(item);
      } else {
        copy[groupIndex].items.splice(index, 1, item);
      }
      persist(copy);
      return copy;
    });
  }

  function remove(index: number, groupIndex = defaultGroupIndex) {
    setStateGroups((prev) => {
      const copy = prev.map((g) => ({ ...g, items: [...g.items] }));
      if (!copy[groupIndex]) return prev;
      copy[groupIndex].items = copy[groupIndex].items.filter((_, i) => i !== index);
      persist(copy);
      return copy;
    });
  }

  function moveItem(source: DragSource, target: DropTarget) {
    setStateGroups((prev) => {
      const copy = prev.map((g) => ({ ...g, items: [...g.items] }));
      const sourceGroup = copy[source.groupIndex];
      const targetGroup = copy[target.groupIndex];
      if (!sourceGroup || !targetGroup) return prev;
      if (!sourceGroup.items[source.index]) return prev;

      const [moved] = sourceGroup.items.splice(source.index, 1);
      const sameGroup = source.groupIndex === target.groupIndex;
      const insertIndex = sameGroup && source.index < target.index
        ? Math.max(0, target.index - 1)
        : target.index;
      const boundedIndex = Math.max(0, Math.min(insertIndex, targetGroup.items.length));
      targetGroup.items.splice(boundedIndex, 0, moved);

      persist(copy);
      return copy;
    });
  }

  function handleDrop(target: DropTarget) {
    if (!dragSource) return;
    moveItem(dragSource, target);
    setDragSource(null);
    setDropTarget(null);
  }

  function handleDragEnd() {
    setDragSource(null);
    setDropTarget(null);
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      {stateGroups.map((group, gi) => (
        <Box key={gi} sx={{ mb: 1 }}>
          {group.label && (
            <Typography variant="caption" sx={{ color: 'rgba(200,210,230,0.7)', ml: 0.5 }}>
              {group.label}
            </Typography>
          )}

          {layout === 'square' ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fit, minmax(${squareMin}px, ${squareMin}px))`,
                gap: squareGap,
              }}
              onDragOver={(e) => {
                if (!allowEdit || locked || !dragSource) return;
                e.preventDefault();
                setDropTarget({ groupIndex: gi, index: group.items.length });
              }}
              onDrop={(e) => {
                if (!allowEdit || locked || !dragSource) return;
                e.preventDefault();
                handleDrop({ groupIndex: gi, index: group.items.length });
              }}
            >
              {group.items.map((link, i) => (
                <Box
                  key={`${gi}-${i}-${link.url}`}
                  draggable={allowEdit && !locked}
                  onDragStart={() => {
                    setDragSource({ groupIndex: gi, index: i });
                    setDropTarget({ groupIndex: gi, index: i });
                  }}
                  onDragOver={(e) => {
                    if (!allowEdit || locked || !dragSource) return;
                    e.preventDefault();
                    setDropTarget({ groupIndex: gi, index: i });
                  }}
                  onDrop={(e) => {
                    if (!allowEdit || locked || !dragSource) return;
                    e.preventDefault();
                    handleDrop({ groupIndex: gi, index: i });
                  }}
                  onDragEnd={handleDragEnd}
                  sx={{
                    opacity: dragSource?.groupIndex === gi && dragSource?.index === i ? 0.45 : 1,
                    outline:
                      dropTarget?.groupIndex === gi && dropTarget?.index === i
                        ? '1px dashed rgba(144, 202, 249, 0.7)'
                        : 'none',
                    outlineOffset: 1,
                    borderRadius: 1.2,
                    cursor: allowEdit && !locked ? 'grab' : 'default',
                  }}
                >
                  <SquareLink
                    link={link}
                    allowEdit={allowEdit}
                    locked={locked}
                    onEdit={() => {
                      setEditing({ ...link, index: i, groupIndex: gi });
                      setOpen(true);
                    }}
                    onDelete={() => remove(i, gi)}
                    min={squareMin}
                  />
                </Box>
              ))}
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 1,
              }}
              onDragOver={(e) => {
                if (!allowEdit || locked || !dragSource) return;
                e.preventDefault();
                setDropTarget({ groupIndex: gi, index: group.items.length });
              }}
              onDrop={(e) => {
                if (!allowEdit || locked || !dragSource) return;
                e.preventDefault();
                handleDrop({ groupIndex: gi, index: group.items.length });
              }}
            >
              {group.items.map((link, i) => (
                <Stack
                  key={`${gi}-${i}-${link.url}`}
                  component="a"
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  draggable={allowEdit && !locked}
                  onDragStart={() => {
                    setDragSource({ groupIndex: gi, index: i });
                    setDropTarget({ groupIndex: gi, index: i });
                  }}
                  onDragOver={(e) => {
                    if (!allowEdit || locked || !dragSource) return;
                    e.preventDefault();
                    setDropTarget({ groupIndex: gi, index: i });
                  }}
                  onDrop={(e) => {
                    if (!allowEdit || locked || !dragSource) return;
                    e.preventDefault();
                    handleDrop({ groupIndex: gi, index: i });
                  }}
                  onDragEnd={handleDragEnd}
                  sx={{
                    p: 1,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    borderRadius: 1,
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background-color 120ms ease',
                    '&:hover': { bgcolor: 'rgba(144,202,249,0.12)' },
                    opacity: dragSource?.groupIndex === gi && dragSource?.index === i ? 0.45 : 1,
                    outline:
                      dropTarget?.groupIndex === gi && dropTarget?.index === i
                        ? '1px dashed rgba(144, 202, 249, 0.7)'
                        : 'none',
                    outlineOffset: 1,
                    cursor: allowEdit && !locked ? 'grab' : 'default',
                  }}
                  >
                    <Avatar src={link.icon} alt={link.label} sx={{ width: 28, height: 28 }}>
                      {link.label?.[0]?.toUpperCase()}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Tooltip title={link.url}>
                        <Typography variant="body2" noWrap sx={{ color: 'rgba(200, 210, 230, 0.85)' }}>
                          {link.label || link.url}
                        </Typography>
                      </Tooltip>
                    </Box>
                    {allowEdit && !locked && (
                      <Stack direction="row" spacing={0.5}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditing({ ...link, index: i, groupIndex: gi });
                            setOpen(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            remove(i, gi);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </Stack>
              ))}
            </Box>
          )}
        </Box>
      ))}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing?.index != null ? 'Edit Link' : 'Add Link'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Label"
              size="small"
              value={editing?.label || ''}
              onChange={(e) => setEditing({ ...editing!, label: e.target.value })}
            />
            <TextField
              label="URL"
              size="small"
              value={editing?.url || ''}
              onChange={(e) => setEditing({ ...editing, url: e.target.value })}
            />
            <TextField
              label="Icon URL"
              size="small"
              value={editing?.icon || ''}
              onChange={(e) => setEditing({ ...editing!, icon: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!editing?.url) {
                setError('URL is required');
                return;
              }
              const payload: LinkItem = {
                label: editing.label?.trim() || editing.url,
                url: editing.url.trim(),
                icon: editing.icon?.trim() || '',
              };
              upsert(payload, editing?.index ?? null, editing?.groupIndex ?? defaultGroupIndex);
              setOpen(false);
              setEditing(null);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
