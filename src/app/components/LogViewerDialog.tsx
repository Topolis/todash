import React, { useEffect, useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Chip,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { logger, type LogEntry, type LogLevel } from '../../lib/logger';

interface LogViewerDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function LogViewerDialog({ open, onClose }: LogViewerDialogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel[]>(['debug', 'info', 'warn', 'error']);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const contentRef = useRef<HTMLDivElement>(null);

  const stats = logger.getStats();
  const isNearFull = stats.utilizationPercent >= 80;

  const toggleExpanded = (index: number) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const fetchLogs = async () => {
    try {
      // Get client-side logs
      const clientLogs = logger.getLogs();
      
      // Get server-side logs
      const isDev = window.location.port === '5173';
      const apiBase = isDev ? 'http://localhost:4000' : '';
      const response = await fetch(`${apiBase}/api/logs`);
      const data = await response.json();
      const serverLogs = data.logs || [];

      // Merge and sort by timestamp
      const allLogs = [...clientLogs, ...serverLogs].sort((a, b) => a.timestamp - b.timestamp);
      setLogs(allLogs);
    } catch (error) {
      logger.error('LogViewer', 'Failed to fetch logs', error);
    }
  };

  const clearLogs = async () => {
    try {
      // Clear client logs
      logger.clearLogs();
      
      // Clear server logs
      const isDev = window.location.port === '5173';
      const apiBase = isDev ? 'http://localhost:4000' : '';
      await fetch(`${apiBase}/api/logs`, { method: 'DELETE' });
      
      setLogs([]);
    } catch (error) {
      logger.error('LogViewer', 'Failed to clear logs', error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLogs();
      
      // Subscribe to new log entries
      const unsubscribe = logger.subscribe((entry) => {
        setLogs(prev => [...prev, entry].sort((a, b) => a.timestamp - b.timestamp));
      });

      // Refresh every 2 seconds
      const interval = setInterval(fetchLogs, 2000);

      return () => {
        unsubscribe();
        clearInterval(interval);
      };
    }
  }, [open]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(log => {
    if (!levelFilter.includes(log.level)) return false;
    if (filter && !log.message.toLowerCase().includes(filter.toLowerCase()) && 
        !log.category.toLowerCase().includes(filter.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getLevelColor = (level: LogLevel): 'default' | 'info' | 'warning' | 'error' => {
    switch (level) {
      case 'error': return 'error';
      case 'warn': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: '800px',
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Application Logs
        </Typography>
        <IconButton size="small" onClick={fetchLogs} title="Refresh">
          <RefreshIcon />
        </IconButton>
        <IconButton size="small" onClick={clearLogs} title="Clear logs">
          <DeleteIcon />
        </IconButton>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 3, pb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />
        
        <ToggleButtonGroup
          size="small"
          value={levelFilter}
          onChange={(_, newLevels) => {
            if (newLevels.length > 0) {
              setLevelFilter(newLevels);
            }
          }}
        >
          <ToggleButton value="debug">Debug</ToggleButton>
          <ToggleButton value="info">Info</ToggleButton>
          <ToggleButton value="warn">Warn</ToggleButton>
          <ToggleButton value="error">Error</ToggleButton>
        </ToggleButtonGroup>

        <Button
          size="small"
          variant={autoScroll ? 'contained' : 'outlined'}
          onClick={() => setAutoScroll(!autoScroll)}
        >
          Auto-scroll
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {filteredLogs.length} / {logs.length} logs
          </Typography>
          {isNearFull && (
            <Chip
              label={`${stats.utilizationPercent}% full`}
              size="small"
              color="warning"
              sx={{ height: '18px', fontSize: '10px' }}
            />
          )}
          <Typography variant="caption" color="text.secondary">
            (max: {stats.maxCount})
          </Typography>
        </Box>
      </Box>

      <DialogContent 
        ref={contentRef}
        sx={{ 
          p: 0,
          bgcolor: 'background.default',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
      >
        {filteredLogs.map((log, index) => {
          const isExpanded = expandedLogs.has(index);
          const hasData = log.data !== undefined;

          return (
            <Box
              key={index}
              sx={{
                px: 2,
                py: 0.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Typography
                  component="span"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '11px',
                    minWidth: '80px',
                    fontFamily: 'monospace',
                  }}
                >
                  {formatTime(log.timestamp)}
                </Typography>

                <Chip
                  label={log.level.toUpperCase()}
                  size="small"
                  color={getLevelColor(log.level)}
                  sx={{
                    height: '18px',
                    fontSize: '10px',
                    minWidth: '60px',
                    width: '60px',
                    fontWeight: 'bold',
                  }}
                />

                <Chip
                  label={log.category}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: '18px',
                    fontSize: '10px',
                    minWidth: '100px',
                    width: '100px',
                    '& .MuiChip-label': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }
                  }}
                />

                <Typography
                  component="span"
                  sx={{
                    flexGrow: 1,
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    wordBreak: 'break-word',
                  }}
                >
                  {log.message}
                </Typography>

                {hasData && (
                  <IconButton
                    size="small"
                    onClick={() => toggleExpanded(index)}
                    sx={{
                      p: 0,
                      minWidth: '20px',
                      height: '20px',
                    }}
                  >
                    {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                  </IconButton>
                )}
              </Box>

              {hasData && isExpanded && (
                <Box
                  sx={{
                    mt: 0.5,
                    ml: '260px', // Align with message text (80px time + 60px level + 100px category + 20px gaps)
                    p: 1,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    overflow: 'auto',
                    maxHeight: '300px',
                  }}
                >
                  <pre style={{ margin: 0 }}>
                    {typeof log.data === 'string'
                      ? log.data
                      : JSON.stringify(log.data, null, 2)}
                  </pre>
                </Box>
              )}
            </Box>
          );
        })}
        
        {filteredLogs.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            No logs to display
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

