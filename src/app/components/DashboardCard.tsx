import React, { ReactNode, useContext } from 'react';
import { Card, CardHeader, CardContent, IconButton, Tooltip, SxProps, Theme, Box, styled } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { DashboardThemeContext } from './DashboardThemeContext';

export interface DashboardCardProps {
  title?: string;
  subtitle?: string;
  sx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
  children?: ReactNode;
  onReload?: () => void;
  actions?: ReactNode;
  customHeader?: ReactNode;
}

const StyledCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'panelBackground',
})<{ panelBackground?: string }>(({ theme, panelBackground }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  ...(panelBackground && {
    background: panelBackground,
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
  }),
}));

export default function DashboardCard({
  title,
  subtitle,
  sx,
  contentSx,
  children,
  onReload,
  actions,
  customHeader,
}: DashboardCardProps) {
  const theme = useContext(DashboardThemeContext);

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
    <StyledCard panelBackground={theme.panel?.background} sx={sx}>
      {customHeader ? (
        <Box sx={{ px: 2, pt: 1.5, pb: 0 }}>
          {customHeader}
        </Box>
      ) : (
        (title || actions || onReload) && (
          <CardHeader
            title={title}
            subheader={subtitle}
            action={actionsNode}
            sx={{ pb: 0 }}
            titleTypographyProps={{ variant: 'subtitle2', sx: { color: 'rgba(200,210,230,0.85)' } }}
            subheaderTypographyProps={{ variant: 'caption', sx: { color: 'rgba(200,210,230,0.6)' } }}
          />
        )
      )}
      <CardContent sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden', ...contentSx }}>
        {children}
      </CardContent>
    </StyledCard>
  );
}
