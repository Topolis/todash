import React from 'react';
import { Card, CardHeader, CardContent, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

export default function DashboardCard({ title, subtitle, sx, children, onReload, actions }) {
  const actionsNode = (
    <>
      {actions}
      {onReload && (
        <Tooltip title="Reload">
          <IconButton size="small" onClick={onReload} aria-label="reload">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </>
  );

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...sx }}>
      {(title || actions || onReload) && (
        <CardHeader title={title} subheader={subtitle} action={actionsNode} sx={{ pb: 0 }} />
      )}
      <CardContent sx={{ flexGrow: 1, minHeight: 0, overflow: 'auto' }}>
        {children}
      </CardContent>
    </Card>
  );
}

