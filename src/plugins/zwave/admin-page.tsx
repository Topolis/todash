import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Card,
  CardContent,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HealingIcon from '@mui/icons-material/Healing';
import InfoIcon from '@mui/icons-material/Info';
import HomeIcon from '@mui/icons-material/Home';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import WarningIcon from '@mui/icons-material/Warning';

interface ZWaveValue {
  commandClass: number;
  commandClassName: string;
  property: string | number;
  propertyKey?: string | number;
  propertyName?: string;
  endpoint?: number;
  value: any;
  metadata?: {
    type?: string;
    readable?: boolean;
    writeable?: boolean;
    label?: string;
    description?: string;
    min?: number;
    max?: number;
    unit?: string;
    states?: Record<number, string>;
  };
}

interface ZWaveNode {
  nodeId: number;
  name: string;  // Custom name set by user (empty if not set)
  displayName: string;  // Fallback display name (name || productLabel || "Node X")
  location?: string;
  manufacturer?: string;
  productLabel?: string;
  productDescription?: string;
  firmwareVersion?: string;
  isListening: boolean;
  isFrequentListening: boolean;
  isRouting: boolean;
  status: number;
  ready: boolean;
  interviewStage?: string;
  isControllerNode: boolean;
  deviceClass?: {
    basic?: string;
    generic?: string;
    specific?: string;
  };
  values?: ZWaveValue[];
  statistics?: {
    commandsTX: number;
    commandsRX: number;
    commandsDroppedTX: number;
    commandsDroppedRX: number;
    timeoutResponse: number;
  };
  health?: {
    successRate: number;
    hasRecentActivity: boolean;
    seemsDead: boolean;
    lastSeen?: Date;
  };
}

interface ControllerInfo {
  homeId: string;
  ownNodeId: number;
  isSecondary: boolean;
  serialApiVersion: string;
  manufacturerId: number;
  productType: number;
  productId: number;
  nodes: number;
}

export default function ZWaveAdminPage() {
  const [nodes, setNodes] = useState<ZWaveNode[]>([]);
  const [controller, setController] = useState<ControllerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [inclusionMode, setInclusionMode] = useState(false);
  const [exclusionMode, setExclusionMode] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; node?: ZWaveNode }>({ open: false });
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [lastAddedNode, setLastAddedNode] = useState<{ nodeId: number; timestamp: number } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [nodesRes, controllerRes] = await Promise.all([
        fetch('/api/zwave/admin/nodes'),
        fetch('/api/zwave/admin/controller'),
      ]);

      if (!nodesRes.ok || !controllerRes.ok) {
        throw new Error('Failed to load Z-Wave data');
      }

      const nodesData = await nodesRes.json();
      const controllerData = await controllerRes.json();

      setNodes(nodesData.nodes);
      setController(controllerData);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for driver ready events via SSE
    const eventSource = new EventSource('/api/zwave/admin/events');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'driver-ready') {
          console.log('[Z-Wave] Driver ready - reloading data');
          loadData();
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Poll for newly added nodes during inclusion mode
  useEffect(() => {
    if (!inclusionMode) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/zwave/admin/inclusion/last-added');
        if (res.ok) {
          const data = await res.json();
          if (data && data.nodeId) {
            setLastAddedNode(data);
          }
        }
      } catch (e) {
        // Ignore polling errors
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [inclusionMode]);

  const handleStartInclusion = async () => {
    try {
      // Clear previous last added node
      setLastAddedNode(null);
      await fetch('/api/zwave/admin/inclusion/clear-last-added', { method: 'POST' });

      const res = await fetch('/api/zwave/admin/inclusion/start', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start inclusion');
      setInclusionMode(true);
      setTimeout(() => setInclusionMode(false), 60000); // Auto-stop after 60s
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleStopInclusion = async () => {
    try {
      const res = await fetch('/api/zwave/admin/inclusion/stop', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to stop inclusion');
      setInclusionMode(false);
      loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleStartExclusion = async () => {
    try {
      const res = await fetch('/api/zwave/admin/exclusion/start', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start exclusion');
      setExclusionMode(true);
      setTimeout(() => setExclusionMode(false), 60000); // Auto-stop after 60s
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleStopExclusion = async () => {
    try {
      const res = await fetch('/api/zwave/admin/exclusion/stop', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to stop exclusion');
      setExclusionMode(false);
      loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleHealNode = async (nodeId: number) => {
    try {
      const res = await fetch(`/api/zwave/admin/node/${nodeId}/heal`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to heal node');
      alert(`Healing node ${nodeId}...`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleReinterviewNode = async (nodeId: number) => {
    try {
      const res = await fetch(`/api/zwave/admin/node/${nodeId}/interview`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to re-interview node');
      alert(`Re-interviewing node ${nodeId}...`);
      loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleRemoveNode = async (nodeId: number) => {
    if (!confirm(`Are you sure you want to remove node ${nodeId}? This should only be used for failed nodes.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/zwave/admin/node/${nodeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove node');
      loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handlePingNode = async (nodeId: number) => {
    try {
      const res = await fetch(`/api/zwave/admin/node/${nodeId}/ping`, { method: 'POST' });
      const data = await res.json();

      if (data.alive) {
        alert(`✅ Node ${nodeId} is ALIVE!\n\nResponse time: ${data.responseTime}ms\n\nThe node is connected and responding to commands.`);
      } else {
        alert(`❌ Node ${nodeId} did NOT respond.\n\nThe node may be:\n- Powered off\n- Out of range\n- Moved to another controller\n- Failed\n\nConsider removing it if it's no longer in use.`);
      }

      loadData(); // Refresh to update statistics
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleCheckFailed = async (nodeId: number) => {
    try {
      const res = await fetch(`/api/zwave/admin/node/${nodeId}/check-lifespan`, { method: 'POST' });
      const data = await res.json();

      if (data.isFailed) {
        const shouldRemove = confirm(`⚠️ Node ${nodeId} is marked as FAILED.\n\nThis means the controller has determined it's no longer reachable.\n\nDo you want to remove it from the network?`);
        if (shouldRemove) {
          await handleRemoveNode(nodeId);
        }
      } else {
        alert(`✅ Node ${nodeId} is NOT marked as failed.\n\nThe controller still considers this node part of the network.\n\nIf you believe it's gone, try pinging it first.`);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleHealNetwork = async () => {
    if (!confirm('Heal the entire network? This may take a while.')) {
      return;
    }

    try {
      const res = await fetch('/api/zwave/admin/heal-network', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to heal network');
      alert('Network healing started. This may take several minutes.');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleEditNode = (node: ZWaveNode) => {
    setEditName(node.name);
    setEditLocation(node.location || '');
    setEditDialog({ open: true, node });
  };

  const handleSaveEdit = async () => {
    if (!editDialog.node) return;

    try {
      const nodeId = editDialog.node.nodeId;

      if (editName !== editDialog.node.name) {
        const res = await fetch(`/api/zwave/admin/node/${nodeId}/name`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName }),
        });
        if (!res.ok) throw new Error('Failed to update name');
      }

      if (editLocation !== (editDialog.node.location || '')) {
        const res = await fetch(`/api/zwave/admin/node/${nodeId}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location: editLocation }),
        });
        if (!res.ok) throw new Error('Failed to update location');
      }

      setEditDialog({ open: false });
      loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const getStatusColor = (status: number) => {
    if (status === 4) return 'success';
    if (status === 2) return 'info';
    if (status === 1) return 'warning';
    if (status === 3) return 'error';
    return 'default';
  };

  const getStatusLabel = (status: number) => {
    if (status === 4) return 'Alive';
    if (status === 2) return 'Awake';
    if (status === 1) return 'Asleep';
    if (status === 3) return 'Dead';
    return 'Unknown';
  };

  const toggleNodeExpanded = (nodeId: number) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const formatValue = (value: any, metadata?: ZWaveValue['metadata']) => {
    if (value === null || value === undefined) return '-';
    if (metadata?.states && typeof value === 'number') {
      return metadata.states[value] || value;
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (metadata?.unit) return `${value} ${metadata.unit}`;
    return String(value);
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Z-Wave Network Management
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<HomeIcon />}
            href="/"
            sx={{ mr: 1 }}
          >
            Dashboard
          </Button>
          <IconButton onClick={loadData}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
        <Tab label="Nodes" />
        <Tab label="Controller Info" />
        <Tab label="Network Tools" />
      </Tabs>

      {/* Nodes Tab */}
      {tabValue === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width="50"></TableCell>
                <TableCell>Node ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Manufacturer</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Health</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {nodes.map((node) => (
                <React.Fragment key={node.nodeId}>
                  <TableRow>
                    <TableCell>
                      <IconButton size="small" onClick={() => toggleNodeExpanded(node.nodeId)}>
                        {expandedNodes.has(node.nodeId) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      {node.nodeId}
                      {node.health?.seemsDead && (
                        <Tooltip title="This node appears to be dead or disconnected">
                          <WarningIcon fontSize="small" color="warning" sx={{ ml: 0.5, verticalAlign: 'middle' }} />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          {node.name ? (
                            <>
                              <Typography variant="body2" fontWeight="medium">
                                {node.name}
                              </Typography>
                              {node.productLabel && (
                                <Typography variant="caption" color="text.secondary">
                                  {node.productLabel}
                                </Typography>
                              )}
                            </>
                          ) : (
                            <>
                              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                {node.productLabel || `Node ${node.nodeId}`}
                              </Typography>
                              <Typography variant="caption" color="warning.main">
                                Click ✏️ to set name
                              </Typography>
                            </>
                          )}
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => handleEditNode(node)}
                          title="Edit name and location"
                          sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>{node.location || '-'}</TableCell>
                    <TableCell>{node.manufacturer || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(node.status)}
                        color={getStatusColor(node.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {node.health && !node.isControllerNode && (
                        <Box>
                          <Typography variant="body2">
                            {node.health.successRate}% success
                          </Typography>
                          {!node.health.hasRecentActivity && (
                            <Typography variant="caption" color="warning.main">
                              No activity
                            </Typography>
                          )}
                        </Box>
                      )}
                      {node.isControllerNode && '-'}
                    </TableCell>
                    <TableCell>
                      {node.isControllerNode ? 'Controller' : node.deviceClass?.generic || '-'}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handlePingNode(node.nodeId)} title="Ping / Test Connection">
                        <NetworkCheckIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleHealNode(node.nodeId)} title="Heal">
                        <HealingIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleReinterviewNode(node.nodeId)} title="Re-interview">
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                      {!node.isControllerNode && (
                        <>
                          <IconButton size="small" onClick={() => handleCheckFailed(node.nodeId)} title="Check if Failed">
                            <WarningIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleRemoveNode(node.nodeId)} title="Remove Failed">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedNodes.has(node.nodeId) && (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ bgcolor: 'background.default', p: 3 }}>
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            Node {node.nodeId} Details
                          </Typography>

                          {/* Device Info */}
                          <Card sx={{ mb: 2 }}>
                            <CardContent>
                              <Typography variant="subtitle1" gutterBottom>
                                Device Information
                              </Typography>
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 6, md: 3 }}>
                                  <Typography variant="body2" color="text.secondary">Product</Typography>
                                  <Typography variant="body1">{node.productLabel || '-'}</Typography>
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                  <Typography variant="body2" color="text.secondary">Manufacturer</Typography>
                                  <Typography variant="body1">{node.manufacturer || '-'}</Typography>
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                  <Typography variant="body2" color="text.secondary">Firmware</Typography>
                                  <Typography variant="body1">{node.firmwareVersion || '-'}</Typography>
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                  <Typography variant="body2" color="text.secondary">Interview Stage</Typography>
                                  <Typography variant="body1">{node.interviewStage || '-'}</Typography>
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                  <Typography variant="body2" color="text.secondary">Listening</Typography>
                                  <Typography variant="body1">{node.isListening ? 'Yes' : 'No'}</Typography>
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                  <Typography variant="body2" color="text.secondary">Routing</Typography>
                                  <Typography variant="body1">{node.isRouting ? 'Yes' : 'No'}</Typography>
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                  <Typography variant="body2" color="text.secondary">Device Class</Typography>
                                  <Typography variant="body1">{node.deviceClass?.generic || '-'}</Typography>
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                  <Typography variant="body2" color="text.secondary">Specific Class</Typography>
                                  <Typography variant="body1">{node.deviceClass?.specific || '-'}</Typography>
                                </Grid>
                              </Grid>
                            </CardContent>
                          </Card>

                          {/* Statistics */}
                          {node.statistics && (
                            <Card sx={{ mb: 2 }}>
                              <CardContent>
                                <Typography variant="subtitle1" gutterBottom>
                                  Communication Statistics
                                </Typography>
                                <Grid container spacing={2}>
                                  <Grid size={{ xs: 6, md: 2 }}>
                                    <Typography variant="body2" color="text.secondary">Commands TX</Typography>
                                    <Typography variant="body1">{node.statistics.commandsTX}</Typography>
                                  </Grid>
                                  <Grid size={{ xs: 6, md: 2 }}>
                                    <Typography variant="body2" color="text.secondary">Commands RX</Typography>
                                    <Typography variant="body1">{node.statistics.commandsRX}</Typography>
                                  </Grid>
                                  <Grid size={{ xs: 6, md: 2 }}>
                                    <Typography variant="body2" color="text.secondary">Dropped TX</Typography>
                                    <Typography variant="body1">{node.statistics.commandsDroppedTX}</Typography>
                                  </Grid>
                                  <Grid size={{ xs: 6, md: 2 }}>
                                    <Typography variant="body2" color="text.secondary">Dropped RX</Typography>
                                    <Typography variant="body1">{node.statistics.commandsDroppedRX}</Typography>
                                  </Grid>
                                  <Grid size={{ xs: 6, md: 2 }}>
                                    <Typography variant="body2" color="text.secondary">Timeouts</Typography>
                                    <Typography variant="body1">{node.statistics.timeoutResponse}</Typography>
                                  </Grid>
                                </Grid>
                              </CardContent>
                            </Card>
                          )}

                          {/* Values */}
                          {node.values && node.values.length > 0 && (
                            <Card>
                              <CardContent>
                                <Typography variant="subtitle1" gutterBottom>
                                  Values ({node.values.length})
                                </Typography>
                                <TableContainer>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Command Class</TableCell>
                                        <TableCell>Property</TableCell>
                                        <TableCell>Value</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>R/W</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {node.values.map((val, idx) => (
                                        <TableRow key={idx}>
                                          <TableCell>
                                            <Typography variant="body2">{val.commandClassName}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              CC {val.commandClass}
                                              {val.endpoint !== undefined && ` EP ${val.endpoint}`}
                                            </Typography>
                                          </TableCell>
                                          <TableCell>
                                            <Typography variant="body2">
                                              {val.metadata?.label || val.propertyName || String(val.property)}
                                            </Typography>
                                            {val.metadata?.description && (
                                              <Typography variant="caption" color="text.secondary">
                                                {val.metadata.description}
                                              </Typography>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <strong>{formatValue(val.value, val.metadata)}</strong>
                                          </TableCell>
                                          <TableCell>{val.metadata?.type || '-'}</TableCell>
                                          <TableCell>
                                            {val.metadata?.readable && 'R'}
                                            {val.metadata?.writeable && 'W'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              </CardContent>
                            </Card>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Controller Info Tab */}
      {tabValue === 1 && controller && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Controller Information
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2"><strong>Home ID:</strong> {controller.homeId}</Typography>
                  <Typography variant="body2"><strong>Node ID:</strong> {controller.ownNodeId}</Typography>
                  <Typography variant="body2"><strong>Serial API Version:</strong> {controller.serialApiVersion}</Typography>
                  <Typography variant="body2"><strong>Manufacturer ID:</strong> {controller.manufacturerId}</Typography>
                  <Typography variant="body2"><strong>Product Type:</strong> {controller.productType}</Typography>
                  <Typography variant="body2"><strong>Product ID:</strong> {controller.productId}</Typography>
                  <Typography variant="body2"><strong>Total Nodes:</strong> {controller.nodes}</Typography>
                  <Typography variant="body2"><strong>Is Secondary:</strong> {controller.isSecondary ? 'Yes' : 'No'}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Network Tools Tab */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Add Device (Inclusion)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Put your Z-Wave device into inclusion mode, then click Start Inclusion.
                </Typography>
                {inclusionMode ? (
                  <Box>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Inclusion mode active. Activate your device now.
                    </Alert>
                    {lastAddedNode && (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        ✓ Device found! Node {lastAddedNode.nodeId} added to network.
                      </Alert>
                    )}
                    <Button
                      variant="contained"
                      color="error"
                      onClick={handleStopInclusion}
                      fullWidth
                    >
                      Stop Inclusion
                    </Button>
                  </Box>
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleStartInclusion}
                    fullWidth
                  >
                    Start Inclusion
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Remove Device (Exclusion)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Put your Z-Wave device into exclusion mode, then click Start Exclusion.
                </Typography>
                {exclusionMode ? (
                  <Box>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      Exclusion mode active. Activate your device now.
                    </Alert>
                    <Button
                      variant="contained"
                      color="error"
                      onClick={handleStopExclusion}
                      fullWidth
                    >
                      Stop Exclusion
                    </Button>
                  </Box>
                ) : (
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<RemoveIcon />}
                    onClick={handleStartExclusion}
                    fullWidth
                  >
                    Start Exclusion
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Network Healing
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Heal the entire network to optimize routes. This may take several minutes.
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<HealingIcon />}
                  onClick={handleHealNetwork}
                >
                  Heal Network
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Edit Node Dialog */}
      <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false })} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit Node {editDialog.node?.nodeId}
          {editDialog.node?.productLabel && (
            <Typography variant="body2" color="text.secondary">
              {editDialog.node.productLabel}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              autoFocus
              margin="dense"
              label="Custom Name"
              type="text"
              fullWidth
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={editDialog.node?.productLabel || `Node ${editDialog.node?.nodeId}`}
              helperText="Give this device a friendly name (e.g., 'Living Room Thermostat', 'Front Door Lock')"
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Location"
              type="text"
              fullWidth
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              placeholder="e.g., Living Room, Kitchen, Bedroom"
              helperText="Optional: Specify where this device is located"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false })}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

