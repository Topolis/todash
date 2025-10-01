import React from 'react';
import { Avatar, Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { LinkItem } from './data';

export interface SquareLinkProps {
  link: LinkItem;
  allowEdit?: boolean;
  locked?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  min?: number;
}

export default function SquareLink({
  link,
  allowEdit = true,
  locked = true,
  onEdit,
  onDelete,
  min = 64,
}: SquareLinkProps) {
  const bg = 'rgba(255,255,255,0.06)';

  return (
    <Box
      sx={{
        position: 'relative',
        flex: 1,
        borderRadius: 1.2,
        bgcolor: bg,
        color: 'inherit',
        textDecoration: 'none',
        transition: 'background-color 120ms ease',
        '&:hover': { bgcolor: 'rgba(108, 141, 168, 0.18)' },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: min,
        m: 0,
      }}
      component="a"
      href={link.url}
      target="_blank"
      rel="noreferrer"
    >
      <Stack spacing={0} alignItems="center" sx={{ pt: '10px', pb: '5px', my: 0 }}>
        <Avatar src={link.icon} alt={link.label} sx={{ width: 32, height: 32 }}>
          {link.label?.[0]?.toUpperCase()}
        </Avatar>
        <Tooltip title={link.label || link.url}>
          <Typography
            variant="caption"
            noWrap
            sx={{
              maxWidth: min * 1.2,
              color: 'rgba(220, 230, 245, 0.9)',
              fontSize: '0.68rem',
              lineHeight: 1,
              pt: '5px',
            }}
          >
            {link.label || link.url}
          </Typography>
        </Tooltip>
      </Stack>
      {allowEdit && !locked && (
        <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 4, right: 4 }}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit?.();
            }}
          >
            <EditIcon fontSize="inherit" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete?.();
            }}
          >
            <DeleteIcon fontSize="inherit" />
          </IconButton>
        </Stack>
      )}
    </Box>
  );
}
