import React, { ReactNode } from 'react';
import { Card, CardHeader, CardContent, IconButton, Tooltip, SxProps, Theme } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

export interface DashboardCardProps {
  title?: string;
  subtitle?: string;
  sx?: SxProps<Theme>;
  children?: ReactNode;
  onReload?: () => void;
  actions?: ReactNode;
}

export default function DashboardCard({
  title,
  subtitle,
  sx,
  children,
  onReload,
  actions,
}: DashboardCardProps) {
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
        <CardHeader
          title={title}
          subheader={subtitle}
          action={actionsNode}
          sx={{ pb: 0 }}
          titleTypographyProps={{ variant: 'subtitle2', sx: { color: 'rgba(200,210,230,0.85)' } }}
          subheaderTypographyProps={{ variant: 'caption', sx: { color: 'rgba(200,210,230,0.6)' } }}
        />
      )}
      <CardContent sx={{ flexGrow: 1, minHeight: 0, overflow: 'auto' }}>
        {children}
      </CardContent>
    </Card>
  );
}
