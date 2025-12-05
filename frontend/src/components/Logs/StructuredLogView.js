// Updated StructuredLogView.js with Assign Ticket functionality
import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Grid,
  Chip,
  Button,
  Tooltip,
  Alert,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  TextField,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WarningIcon from '@mui/icons-material/Warning';
import SecurityIcon from '@mui/icons-material/Security';
import DnsIcon from '@mui/icons-material/Dns';
import EventIcon from '@mui/icons-material/Event';
import CodeIcon from '@mui/icons-material/Code';
import ShieldIcon from '@mui/icons-material/Shield';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DescriptionIcon from '@mui/icons-material/Description';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { generateTicket } from '../../services/logs';
import api from '../../services/auth';
import FlagIcon from '@mui/icons-material/Flag';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';


import { deleteLog } from '../../services/logs'; // adjust path if needed
import DeleteIcon from '@mui/icons-material/Delete';


// StructuredLogView component - displays detailed log information in a dialog
export const StructuredLogView = ({ data, onClose, open, onDeleteSuccess }) => {




 



  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [ticketSnackbar, setTicketSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [falsePositiveDialog, setFalsePositiveDialog] = useState(false);
  const [availableFields, setAvailableFields] = useState([]);
  const [selectedField, setSelectedField] = useState('');
  const [selectedValue, setSelectedValue] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('equals');
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [previewCount, setPreviewCount] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCreateRule, setLoadingCreateRule] = useState(false);

  const textAreaRef = useRef(null);

  // Inside your StructuredLogView component function:
  //added by raman to add the delete functionality in the log view
const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
const [deleting, setDeleting] = useState(false);
// Parent component that renders log list and StructuredLogView
const [logs, setLogs] = useState([]); // your logs array state
const [selectedLog, setSelectedLog] = useState(null);
const [isDialogOpen, setIsDialogOpen] = useState(false);

const handleDeleteSuccess = (deletedId) => {
  setLogs(prevLogs => prevLogs.filter(log => log.id !== deletedId));
  // This removes the deleted log from the list UI immediately
};






useEffect(() => {
  if (ticketSnackbar.open) {
    const timer = setTimeout(() => {
      setTicketSnackbar(snackbar => ({ ...snackbar, open: false }));
    }, 1000); // hides after 1 seconds
    return () => clearTimeout(timer);
  }
}, [ticketSnackbar.open]);



  // add by raman

  //ful screen functionality 
  const [fullscreen, setFullscreen] = useState(false);
  const handleToggleFullscreen = () => setFullscreen(f => !f);


  // Fetch users for assign dialog
  useEffect(() => {
    if (assignDialogOpen) {
      fetchUsers();
    }
  }, [assignDialogOpen]);

  // Fetch available users for assignment
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await api.get('/users');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setTicketSnackbar({
        open: true,
        message: 'Failed to load users',
        severity: 'error'
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  // Tab change handler
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Generate ticket
  const handleGenerateTicket = async () => {
    try {
      setLoadingTicket(true);

      if (!data) {
        setTicketSnackbar({
          open: true,
          message: 'No log selected',
          severity: 'error'
        });
        return;
      }

      const result = await generateTicket(
        data,
        'Ticket generated from log view'
      );

      setTicketSnackbar({
        open: true,
        message: `Ticket ${result.ticket.ticketId} generated successfully!`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error generating ticket:', error);
      setTicketSnackbar({
        open: true,
        message: error.message || 'Failed to generate ticket',
        severity: 'error'
      });
    } finally {
      setLoadingTicket(false);
    }
  };

  // Assign ticket functionality
  const handleAssignTicket = async () => {
    try {
      setAssignLoading(true);

      // First generate a ticket if not already a ticket
      let ticketId;
      if (!data.ticketId) {
        const result = await generateTicket(
          data,
          'Ticket generated for assignment'
        );
        ticketId = result.ticket.id;
      } else {
        ticketId = data.id;
      }

      // Then assign the ticket
      await api.patch(`/tickets/${ticketId}/assign`, {
        assignedToId: selectedUser
      });

      setAssignDialogOpen(false);
      setTicketSnackbar({
        open: true,
        message: 'Ticket assigned successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error assigning ticket:', error);
      setTicketSnackbar({
        open: true,
        message: error.message || 'Failed to assign ticket',
        severity: 'error'
      });
    } finally {
      setAssignLoading(false);
    }
  };

  // Copy to clipboard
// Add this to your component (e.g., Session.js)
const copyToClipboard = (text) => {
  if (!text) return; // Prevent copying empty text

  const handleSuccess = () => {
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  if (navigator.clipboard) {
    // Modern Clipboard API (requires secure context like HTTPS)
    navigator.clipboard.writeText(text)
      .then(handleSuccess)
      .catch((err) => {
        console.error('Clipboard API failed:', err);
      });
  } else {
    // Fallback for non-secure contexts or older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px'; // Standard off-screen positioning
    textarea.style.top = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        handleSuccess();
      } else {
        console.error('Fallback copy failed');
      }
    } catch (err) {
      console.error('Error in fallback copy:', err);
    } finally {
      document.body.removeChild(textarea); // Always clean up
    }
  }
};

  // Get severity color based on rule level
  const getSeverityColor = (level) => {
    const numLevel = parseInt(level, 10);
    if (numLevel >= 15) return 'error';
    if (numLevel >= 12) return 'error';
    if (numLevel >= 8) return 'warning';
    if (numLevel >= 4) return 'info';
    return 'success';
  };

  // Get severity text based on rule level
  const getSeverityText = (level) => {
    const numLevel = parseInt(level, 10);
    if (numLevel >= 15) return 'Critical';
    if (numLevel >= 12) return 'High';
    if (numLevel >= 8) return 'Medium';
    if (numLevel >= 4) return 'Low';
    return 'Info';
  };

  // Format timestamp to be more readable
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return timestamp;
    }
  };

  const extractAllFields = (obj, prefix = '', fields = []) => {
    Object.keys(obj).forEach(key => {
      if (key === 'raw_log' || key === '_score' || key === '_highlights') return;

      const fullPath = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];

      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          // Recursively extract nested fields
          extractAllFields(value, fullPath, fields);
        } else if (!Array.isArray(value)) {
          // Add primitive fields
          fields.push({
            path: fullPath,
            value: String(value),
            type: typeof value
          });
        }
      }
    });

    return fields;
  };

  useEffect(() => {
    if (falsePositiveDialog && data) {
      const fields = extractAllFields(data);
      setAvailableFields(fields);

      // Suggest common fields
      const suggestedFields = ['rule.id', 'agent.name', 'rule.description'];
      const firstSuggested = suggestedFields.find(path =>
        fields.some(field => field.path === path)
      );

      if (firstSuggested) {
        setSelectedField(firstSuggested);
        const fieldData = fields.find(f => f.path === firstSuggested);
        if (fieldData) {
          setSelectedValue(fieldData.value);
        }
      }
    }
  }, [falsePositiveDialog, data]);

  const handleFieldChange = (event) => {
    const fieldPath = event.target.value;
    setSelectedField(fieldPath);

    // Auto-populate value
    const fieldData = availableFields.find(f => f.path === fieldPath);
    if (fieldData) {
      setSelectedValue(fieldData.value);
    }
  };
 

  // added by raman to check this functionality 
// Ensure you import encodeURIComponent
const handleDeleteLog = async () => {
  setDeleting(true);
  try {
    // Call API; response.data will contain { message: ... }
    const response = await api.delete(`/logs/${encodeURIComponent(data.id)}?timestamp=${encodeURIComponent(data['@timestamp'])}`);

    // Always prefer backend message, fallback to hardcoded one
    setTicketSnackbar({
      open: true,
      message: response.data?.message || 'Log deleted successfully.',
      severity: 'success'
    });

    // ...rest of your logic
    setDeleteConfirmOpen(false);
    onClose();
    if (typeof onDeleteSuccess === 'function') onDeleteSuccess(data.id);

  } catch (error) {
    setTicketSnackbar({
      open: true,
      message: error.response?.data?.message || error.message || 'Failed to delete log.',
      severity: 'error'
    });
  } finally {
    setDeleting(false);
  }
};

  const handlePreviewRule = async () => {
    if (!selectedField || !selectedValue) return;

    try {
      setLoadingPreview(true);
      const response = await api.post('/false-positives/test', {
        conditions: [{
          field_path: selectedField,
          operator: selectedOperator,
          value: selectedValue
        }],
        timeRange: '24h'
      });

      setPreviewCount(response.data.count);
    } catch (error) {
      console.error('Error previewing rule:', error);
      setTicketSnackbar({
        open: true,
        message: 'Failed to preview rule',
        severity: 'error'
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCreateFalsePositiveRule = async () => {
    if (!selectedField || !selectedValue || !ruleName) {
      setTicketSnackbar({
        open: true,
        message: 'Please fill in all required fields',
        severity: 'error'
      });
      return;
    }

    try {
      setLoadingCreateRule(true);

      await api.post('/false-positives', {
        rule_name: ruleName,
        description: ruleDescription,
        conditions: [{
          field_path: selectedField,
          operator: selectedOperator,
          value: selectedValue
        }]
      });

      setFalsePositiveDialog(false);
      setTicketSnackbar({
        open: true,
        message: 'False positive rule created successfully',
        severity: 'success'
      });

      // Reset form
      setRuleName('');
      setRuleDescription('');
      setSelectedField('');
      setSelectedValue('');
      setPreviewCount(0);

    } catch (error) {
      console.error('Error creating false positive rule:', error);
      setTicketSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to create false positive rule',
        severity: 'error'
      });
    } finally {
      setLoadingCreateRule(false);
    }
  };

  // Render MITRE ATT&CK information
  const renderMitreSection = () => {
    if (!data || !data.rule || !data.rule.mitre) return null;

    // Check if there's any MITRE data
    const hasMitreData =
      (data.rule.mitre.id && data.rule.mitre.id.length > 0) ||
      (data.rule.mitre.tactic && data.rule.mitre.tactic.length > 0) ||
      (data.rule.mitre.technique && data.rule.mitre.technique.length > 0);

    if (!hasMitreData) return null;

    const mitreCategories = [
      { name: 'Techniques', items: data.rule.mitre.technique || [] },
      { name: 'Tactics', items: data.rule.mitre.tactic || [] },
      { name: 'IDs', items: data.rule.mitre.id || [] }
    ];

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', mb: 1, color: '#d32f2f' }}>
          <ShieldIcon sx={{ mr: 1 }} />
          MITRE ATT&CK
        </Typography>
        <Box sx={{ pl: 2 }}>
          {mitreCategories.map(category => {
            if (!category.items || category.items.length === 0) return null;
            return (
              <Box key={category.name} sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {category.name}:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pl: 1 }}>
                  {category.items.map((item, idx) => (
                    <Chip
                      key={idx}
                      label={item}
                      size="small"
                      sx={{
                        //change to make the color unified
                        // bgcolor: '#ffebee',
                        // color: '#d32f2f',
                        fontWeight: 500
                      }}
                    />
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  // Render compliance frameworks in a grouped format
  const renderComplianceFrameworks = () => {
    if (!data || !data.rule) return null;

    const frameworks = [
      { name: 'HIPAA', items: data.rule.hipaa, color: '#4caf50' },
      { name: 'PCI DSS', items: data.rule.pci_dss, color: '#ff9800' },
      { name: 'GDPR', items: data.rule.gdpr, color: '#2196f3' },
      { name: 'NIST 800-53', items: data.rule.nist, color: '#9c27b0' },
      { name: 'TSC', items: data.rule.tsc, color: '#795548' },
      { name: 'GPG13', items: data.rule.gpg13, color: '#607d8b' }
    ];

    return (
      <Box>
        {frameworks.map(framework => {
          if (!framework.items || framework.items.length === 0) return null;
          return (
            <Box key={framework.name} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom color="text.secondary">
                {framework.name}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pl: 1 }}>
                {framework.items.map((item, idx) => (
                  <Chip
                    key={idx}
                    label={item}
                    size="small"
                    sx={{ bgcolor: `${framework.color}15`, color: framework.color }}
                  />
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  };

  // Render network flow details
  const renderNetworkInfo = () => {
    if (!data || !data.network) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <DnsIcon sx={{ mr: 1 }} />
          Network Information
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">Source IP</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                {data.network.srcIp || 'N/A'}
                {data.network.srcPort && `:${data.network.srcPort}`}
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">Destination IP</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                {data.network.destIp || 'N/A'}
                {data.network.destPort && `:${data.network.destPort}`}
              </Typography>
            </Paper>
          </Grid>

          {data.network.protocol && (
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">Protocol</Typography>
                <Box sx={{ mt: 1 }}>
                  <Chip
                    label={data.network.protocol}
                    size="small"
                    sx={{ bgcolor: '#e3f2fd', color: '#1976d2' }}
                  />
                </Box>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  };

  // Render structured log data
  const renderStructuredView = () => {
    if (!data) return null;

    return (
      <Box sx={{ p: 2 }}>
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Paper elevation={0} variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <EventIcon sx={{ mr: 1.5 }} color="primary" />
                Basic Information
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">Timestamp</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {formatTimestamp(data['@timestamp'])}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Event ID</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body1" fontWeight="medium" sx={{ mr: 1 }}>
                        {data.id || 'N/A'}
                      </Typography>
                      <Tooltip title="Copy ID">
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(data.id)}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">Rule ID</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {data.rule?.id || 'N/A'}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Severity</Typography>
                    <Chip
                      label={`${data.rule?.level || '0'} - ${getSeverityText(data.rule?.level || '0')}`}
                      color={getSeverityColor(data.rule?.level || '0')}
                      size="small"
                      sx={{ fontWeight: 500 }}
                    />
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Rule Description</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {data.rule?.description || 'N/A'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Agent Information */}
          <Grid item xs={12}>
            <Paper elevation={0} variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <SecurityIcon sx={{ mr: 1.5 }} color="primary" />
                Agent Information
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">Agent Name</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {data.agent?.name || 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">Agent ID</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {data.agent?.id || 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">Agent IP</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {data.agent?.ip || 'N/A'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Network Information */}
          {data.network && Object.keys(data.network).length > 0 && (
            <Grid item xs={12}>
              <Paper elevation={0} variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <DnsIcon sx={{ mr: 1.5 }} color="primary" />
                  Network Information
                </Typography>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" color="text.secondary">Source IP</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {data.network.srcIp || 'N/A'}
                      {data.network.srcPort && `:${data.network.srcPort}`}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" color="text.secondary">Destination IP</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {data.network.destIp || 'N/A'}
                      {data.network.destPort && `:${data.network.destPort}`}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" color="text.secondary">Protocol</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {data.network.protocol || 'N/A'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          )}

          {/* MITRE ATT&CK Information */}
          {renderMitreSection() && (
            <Grid item xs={12}>
              <Paper elevation={0} variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <ShieldIcon sx={{ mr: 1.5 }} color="error" />
                  MITRE ATT&CK
                </Typography>
                {renderMitreSection()}
              </Paper>
            </Grid>
          )}

          {/* Rule Groups */}
          {data.rule?.groups && data.rule.groups.length > 0 && (
            <Grid item xs={12}>
              <Paper elevation={0} variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <SecurityIcon sx={{ mr: 1.5 }} color="primary" />
                  Rule Groups
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                  {data.rule.groups.map((group, idx) => (
                    <Chip
                      key={idx}
                      label={group}
                      size="small"
                      sx={{
                        bgcolor: theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.08)'
                      }}
                    />
                  ))}
                </Box>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  };

  // Render raw JSON data
  const renderJsonView = () => {
    if (!data) return null;

    return (
      <Box sx={{ p: 2, position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
          <Tooltip title="Copy JSON">
            <IconButton
              onClick={() => copyToClipboard(JSON.stringify(data, null, 2))}
              size="small"
              sx={{
                bgcolor: theme.palette.background.paper,
                boxShadow: 1,
                '&:hover': { bgcolor: theme.palette.action.hover }
              }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
            maxHeight: '70vh',
            overflow: 'auto',
            borderRadius: 2,
            fontFamily: '"Roboto Mono", monospace',
            fontSize: '0.875rem',
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            },
            '&::-webkit-scrollbar-thumb': {
              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
            },
          }}
        >
          <pre style={{ margin: 0, overflow: 'visible' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </Paper>
      </Box>
    );
  };

  // Render compliance view
  const renderComplianceView = () => {
    return (
      <Box sx={{ p: 2 }}>
        <Paper elevation={0} variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <ShieldIcon sx={{ mr: 1.5 }} color="primary" />
            Compliance Information
          </Typography>

          {renderComplianceFrameworks() || (
            <Typography variant="body1" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No compliance framework information available for this log.
            </Typography>
          )}
        </Paper>
      </Box>
    );
  };

  // If no data, return null
  if (!data) return null;
  
 // change by raman ful fullscreen functionality
  return (

   
    <Dialog
  open={open}
  onClose={onClose}
  fullScreen={fullscreen}
  maxWidth={fullscreen ? false : "lg"}
  fullWidth={!fullscreen}
  PaperProps={{
    sx: fullscreen
      ? {
          width: "100vw",
          height: "100vh",
          maxWidth: "100vw",
          maxHeight: "100vh",
          borderRadius: 0,
          overflow: "hidden",
          boxShadow: "none"
        }
      : {
          maxHeight: "90vh",
          height: "auto",
          borderRadius: 2
        }
  }}
>

      <DialogTitle sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pb: 1,
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography
  variant="h6"
  component="div"
  sx={{
    mr: 2,
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'normal',     // allow wrapping!
    wordBreak: 'break-word',  // wrap long words if needed
    minWidth: 0,              // prevent overflow issues
    // Optionally: maxWidth: 420
  }}
>
  <SecurityIcon sx={{ mr: 1.5 }} />
  {data.rule?.description || 'Log Details'}
</Typography>

          <Chip
            label={`Level ${data.rule?.level || '0'} - ${getSeverityText(data.rule?.level || '0')}`}
            color={getSeverityColor(data.rule?.level || '0')}
            size="small"
            icon={<WarningIcon />}
          />
        </Box>
      
        <Box>
            {/* added the full screen toggle by raman */}
    {/* Fullscreen toggle */}
    <IconButton
      edge="end"
      onClick={handleToggleFullscreen}
      aria-label={fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      sx={{
        mr: 1,
        bgcolor: fullscreen
          ? theme.palette.action.selected
          : theme.palette.action.hover
      }}
    >
      {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
    </IconButton>
    {/* Close dialog */}
    <IconButton
      edge="end"
      color="inherit"
      onClick={onClose}
      aria-label="close"
      sx={{
        bgcolor: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.05)'
          : 'rgba(0, 0, 0, 0.05)',
        '&:hover': {
          bgcolor: theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.1)'
        }
      }}
    >
      <CloseIcon />
    </IconButton>
  </Box>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="log details tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<SecurityIcon />} iconPosition="start" label="Overview" />
          <Tab icon={<ShieldIcon />} iconPosition="start" label="MITRE & Compliance" />
          <Tab icon={<CodeIcon />} iconPosition="start" label="Raw Data" />
        </Tabs>
      </Box>

      <DialogContent dividers sx={{ p: 0 }}>
        {/* Overview Tab */}
        <Box hidden={tabValue !== 0} role="tabpanel">
          {tabValue === 0 && renderStructuredView()}
        </Box>

        {/* MITRE & Compliance Tab */}
        <Box hidden={tabValue !== 1} role="tabpanel">
          {tabValue === 1 && renderComplianceView()}
        </Box>

        {/* Raw Data Tab */}
        <Box hidden={tabValue !== 2} role="tabpanel">
          {tabValue === 2 && renderJsonView()}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DescriptionIcon />}
          onClick={handleGenerateTicket}
          disabled={loadingTicket}
        >
          {loadingTicket ? <CircularProgress size={24} /> : 'Generate Ticket'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<PersonAddIcon />}
          onClick={() => setAssignDialogOpen(true)}
          color="secondary"
        >
          Assign Ticket
        </Button>
        <Button
          variant="outlined"
          startIcon={<FlagIcon />}
          onClick={() => setFalsePositiveDialog(true)}
          color="warning"
        >
          Mark as False Positive
        </Button>

        <Tooltip title={parseInt(data?.rule?.level, 10) > 5 ? "Only logs with severity 5 or below can be deleted" : "Delete this log"}>
  <span>
    <Button
      variant="outlined"
      color="error"
      startIcon={<DeleteIcon />}
      onClick={() => setDeleteConfirmOpen(true)}
      disabled={!data.id || deleting || parseInt(data?.rule?.level, 10) > 5}
    >
      Delete Log
    </Button>
  </span>
</Tooltip>





        <Button
          variant="contained"
          startIcon={<AssignmentIcon />}
          onClick={onClose}
          color="primary"
        >
          Close
        </Button>
        

      </DialogActions>
      <Dialog
  open={deleteConfirmOpen}
  onClose={() => !deleting && setDeleteConfirmOpen(false)}
  disableEscapeKeyDown={deleting}
>
  <DialogTitle>Confirm Delete</DialogTitle>
  <DialogContent>
    <Typography>
      Are you sure you want to permanently delete this log entry? This action cannot be undone.
    </Typography>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
      Cancel
    </Button>
    <Button
      color="error"
      variant="contained"
      onClick={handleDeleteLog}
      disabled={deleting}
    >
      {deleting ? <CircularProgress size={24} /> : 'Delete'}
    </Button>
  </DialogActions>
</Dialog>


      {/* Assign Ticket Dialog */}
      <Dialog
        open={assignDialogOpen}
        onClose={() => !assignLoading && setAssignDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Assign Ticket
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph sx={{ mt: 1 }}>
            {data.id ?
              'Select a user to assign this ticket to:' :
              'A new ticket will be generated and assigned to the selected user:'
            }
          </Typography>

          {loadingUsers ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Assign To</InputLabel>
              <Select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                label="Assign To"
              >
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.fullName || user.username}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)} disabled={assignLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleAssignTicket}
            variant="contained"
            color="primary"
            disabled={!selectedUser || assignLoading}
          >
            {assignLoading ? <CircularProgress size={24} /> : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* False Positive Rule Dialog */}
      <Dialog
        open={falsePositiveDialog}
        onClose={() => !loadingCreateRule && setFalsePositiveDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Create False Positive Rule
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph sx={{ mt: 1 }}>
            Create a rule to automatically mark similar logs as false positives.
          </Typography>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Rule Name"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                required
                disabled={loadingCreateRule}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description (Optional)"
                value={ruleDescription}
                onChange={(e) => setRuleDescription(e.target.value)}
                multiline
                rows={2}
                disabled={loadingCreateRule}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Field</InputLabel>
                <Select
                  value={selectedField}
                  onChange={handleFieldChange}
                  label="Field"
                  disabled={loadingCreateRule}
                >
                  {availableFields.map((field) => (
                    <MenuItem key={field.path} value={field.path}>
                      {field.path}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Operator</InputLabel>
                <Select
                  value={selectedOperator}
                  onChange={(e) => setSelectedOperator(e.target.value)}
                  label="Operator"
                  disabled={loadingCreateRule}
                >
                  <MenuItem value="equals">Equals</MenuItem>
                  <MenuItem value="regex">Regex Pattern</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Value"
                value={selectedValue}
                onChange={(e) => setSelectedValue(e.target.value)}
                required
                disabled={loadingCreateRule}
                helperText={selectedOperator === 'regex' ? 'Enter a regular expression pattern' : 'Enter the exact value to match'}
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={handlePreviewRule}
                  disabled={!selectedField || !selectedValue || loadingPreview || loadingCreateRule}
                >
                  {loadingPreview ? <CircularProgress size={24} /> : 'Preview'}
                </Button>

                {previewCount > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    This rule will match approximately {previewCount} logs from the last 24 hours
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setFalsePositiveDialog(false)}
            disabled={loadingCreateRule}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateFalsePositiveRule}
            variant="contained"
            color="primary"
            disabled={!selectedField || !selectedValue || !ruleName || loadingCreateRule}
          >
            {loadingCreateRule ? <CircularProgress size={24} /> : 'Create Rule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success message for copy operation */}
      {copySuccess && (
        <Alert
          severity="success"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9999,
            boxShadow: 4
          }}
        >
          Copied to clipboard
        </Alert>
      )}

      {/* Ticket generation feedback */}
      {ticketSnackbar.open && (
        <Alert
          severity={ticketSnackbar.severity}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9999,
            boxShadow: 4
          }}
          onClose={() => setTicketSnackbar({ ...ticketSnackbar, open: false })}
        >
          {ticketSnackbar.message}
        </Alert>
      )}
      

    </Dialog>
    
  );
};