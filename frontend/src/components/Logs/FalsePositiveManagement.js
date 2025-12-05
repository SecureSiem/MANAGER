// frontend/src/components/Logs/FalsePositiveManagement.js
import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Alert,
  TextField,
  InputAdornment,
  CircularProgress,
  Grid,
  Chip,
  Button,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Stack,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider
} from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import FlagIcon from '@mui/icons-material/Flag';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import TestIcon from '@mui/icons-material/BugReport';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import api from '../../services/auth';

const FalsePositiveManagement = () => {
  const theme = useTheme();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalRows, setTotalRows] = useState(0);
  const [stats, setStats] = useState({});
  const [selectedRule, setSelectedRule] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Form states
  const [formData, setFormData] = useState({
    rule_name: '',
    description: '',
    field_path: '',
    operator: 'equals',
    value: '',
    is_active: true
  });

  const { setPageTitle } = useOutletContext();

  useEffect(() => {
    setPageTitle('False Positive Management');
    fetchRules();
    fetchStats();
  }, []);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm !== '') {
        setPage(0);
        fetchRules();
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/false-positives', {
        params: {
          page: page + 1,
          limit: pageSize,
          search: searchTerm
        }
      });

      setRules(response.data.rules || []);
      setTotalRows(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching false positive rules:', error);
      setError('Failed to fetch false positive rules');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/false-positives/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCreateRule = async () => {
    try {
      setLoading(true);
      await api.post('/false-positives', {
        rule_name: formData.rule_name,
        description: formData.description,
        conditions: [{
          field_path: formData.field_path,
          operator: formData.operator,
          value: formData.value
        }]
      });

      setCreateDialogOpen(false);
      resetForm();
      fetchRules();
      fetchStats();
      
      setSnackbar({
        open: true,
        message: 'False positive rule created successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to create rule',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRule = async () => {
    try {
      setLoading(true);
      await api.put(`/false-positives/${selectedRule.id}`, {
        rule_name: formData.rule_name,
        description: formData.description,
        conditions: [{
          field_path: formData.field_path,
          operator: formData.operator,
          value: formData.value
        }],
        is_active: formData.is_active
      });

      setEditDialogOpen(false);
      resetForm();
      fetchRules();
      fetchStats();
      
      setSnackbar({
        open: true,
        message: 'Rule updated successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to update rule',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async () => {
    try {
      setLoading(true);
      await api.delete(`/false-positives/${selectedRule.id}`);

      setDeleteDialogOpen(false);
      setSelectedRule(null);
      fetchRules();
      fetchStats();
      
      setSnackbar({
        open: true,
        message: 'Rule deleted successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to delete rule',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestRule = async () => {
    try {
      setLoading(true);
      const response = await api.post('/false-positives/test', {
        conditions: [{
          field_path: formData.field_path,
          operator: formData.operator,
          value: formData.value
        }],
        timeRange: '24h'
      });

      setSnackbar({
        open: true,
        message: `Rule would match ${response.data.count} logs in the last 24 hours`,
        severity: 'info'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to test rule',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      rule_name: '',
      description: '',
      field_path: '',
      operator: 'equals',
      value: '',
      is_active: true
    });
  };

  const openEditDialog = (rule) => {
    setSelectedRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      description: rule.description || '',
      field_path: rule.conditions[0]?.field_path || '',
      operator: rule.conditions[0]?.operator || 'equals',
      value: rule.conditions[0]?.value || '',
      is_active: rule.is_active
    });
    setEditDialogOpen(true);
  };

  const formatTimestamp = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return 'N/A';
    }
  };

  const columns = [
    {
      field: 'rule_name',
      headerName: 'Rule Name',
      flex: 1.5,
      minWidth: 200,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="medium">
          {params.value}
        </Typography>
      )
    },
    {
      field: 'conditions',
      headerName: 'Condition',
      flex: 2,
      minWidth: 250,
      renderCell: (params) => {
        const condition = params.value[0];
        return (
          <Box>
            <Typography variant="body2" noWrap>
              {condition.field_path} {condition.operator} "{condition.value}"
            </Typography>
          </Box>
        );
      }
    },
    {
      field: 'is_active',
      headerName: 'Status',
      flex: 0.8,
      minWidth: 100,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Active' : 'Inactive'}
          color={params.value ? 'success' : 'default'}
          size="small"
          icon={params.value ? <ToggleOnIcon /> : <ToggleOffIcon />}
        />
      )
    },
    {
      field: 'created_by',
      headerName: 'Created By',
      flex: 1,
      minWidth: 120,
      valueGetter: (params) => params.row.created_by?.username || 'N/A'
    },
    {
      field: 'created_at',
      headerName: 'Created',
      flex: 1,
      minWidth: 150,
      valueGetter: (params) => formatTimestamp(params.row.created_at)
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 1,
      minWidth: 150,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Edit Rule">
            <IconButton
              size="small"
              color="primary"
              onClick={() => openEditDialog(params.row)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Rule">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                setSelectedRule(params.row);
                setDeleteDialogOpen(true);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )
    }
  ];

  return (
    <Box>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2,
          bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.50',
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center' }}>
            <FlagIcon sx={{ mr: 1.5 }} />
            False Positive Management
          </Typography>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                resetForm();
                setCreateDialogOpen(true);
              }}
            >
              Create Rule
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => {
                fetchRules();
                fetchStats();
              }}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {/* Stats Cards */}
       <Grid container spacing={2} sx={{ mb: 2 }}>
  <Grid item xs={12} sm={6} md={3}>
    <Card
      sx={{
        background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', // violet to indigo
        color: '#ffffff',
      }}
    >
      <CardContent sx={{ py: 2 }}>
        <Typography variant="h4" fontWeight="bold">
          {stats.total_rules || 0}
        </Typography>
        <Typography variant="body2">Total Rules</Typography>
      </CardContent>
    </Card>
  </Grid>

  <Grid item xs={12} sm={6} md={3}>
    <Card
      sx={{
        background: 'linear-gradient(135deg, #22C55E, #16A34A)', // green
        color: '#ffffff',
      }}
    >
      <CardContent sx={{ py: 2 }}>
        <Typography variant="h4" fontWeight="bold">
          {stats.active_rules || 0}
        </Typography>
        <Typography variant="body2">Active Rules</Typography>
      </CardContent>
    </Card>
  </Grid>

  <Grid item xs={12} sm={6} md={3}>
    <Card
      sx={{
        background: 'linear-gradient(135deg, #F59E0B, #D97706)', // amber to orange
        color: '#ffffff',
      }}
    >
      <CardContent sx={{ py: 2 }}>
        <Typography variant="h4" fontWeight="bold">
          {stats.inactive_rules || 0}
        </Typography>
        <Typography variant="body2">Inactive Rules</Typography>
      </CardContent>
    </Card>
  </Grid>

  <Grid item xs={12} sm={6} md={3}>
    <Card
      sx={{
        background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', // sky to blue
        color: '#ffffff',
      }}
    >
      <CardContent sx={{ py: 2 }}>
        <Typography variant="h4" fontWeight="bold">
          {stats.total_false_positive_logs?.toLocaleString() || 0}
        </Typography>
        <Typography variant="body2">False Positive Logs</Typography>
      </CardContent>
    </Card>
  </Grid>
</Grid>
{/* change by raman */}

        {/* Search */}
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search rules by name, field, or creator..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setSearchTerm('')}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null
          }}
        />
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Rules Table */}
      <Paper
        sx={{
          height: 'calc(100vh - 400px)',
          width: '100%',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        <DataGrid
          rows={rules}
          columns={columns}
          pagination
          paginationMode="server"
          rowCount={totalRows}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(0);
          }}
          rowsPerPageOptions={[25, 50, 100]}
          disableSelectionOnClick
          loading={loading}
          getRowId={(row) => row.id}
          components={{ Toolbar: GridToolbar }}
          sx={{
            border: 'none',
            '& .MuiDataGrid-cell': {
              borderBottom: `1px solid ${theme.palette.divider}`
            },
            '& .MuiDataGrid-columnHeaders': {
              borderBottom: `2px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
            }
          }}
        />
      </Paper>

      {/* Create Rule Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create False Positive Rule</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Rule Name"
                value={formData.rule_name}
                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description (Optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Field Path"
                value={formData.field_path}
                onChange={(e) => setFormData({ ...formData, field_path: e.target.value })}
                required
                placeholder="e.g., rule.id, agent.name"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Operator</InputLabel>
                <Select
                  value={formData.operator}
                  onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                  label="Operator"
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
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                required
                helperText={formData.operator === 'regex' ? 'Enter a regular expression pattern' : 'Enter the exact value to match'}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                startIcon={<TestIcon />}
                onClick={handleTestRule}
                disabled={!formData.field_path || !formData.value}
              >
                Test Rule
              </Button>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateRule}
            variant="contained"
            disabled={!formData.rule_name || !formData.field_path || !formData.value}
          >
            Create Rule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Rule Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit False Positive Rule</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Rule Name"
                value={formData.rule_name}
                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description (Optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Field Path"
                value={formData.field_path}
                onChange={(e) => setFormData({ ...formData, field_path: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Operator</InputLabel>
                <Select
                  value={formData.operator}
                  onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                  label="Operator"
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
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                startIcon={<TestIcon />}
                onClick={handleTestRule}
                disabled={!formData.field_path || !formData.value}
              >
                Test Rule
              </Button>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleUpdateRule}
            variant="contained"
            disabled={!formData.rule_name || !formData.field_path || !formData.value}
          >
            Update Rule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the rule "{selectedRule?.rule_name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will also update all logs that were marked as false positive by this rule.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteRule}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      {snackbar.open && (
        <Alert
          severity={snackbar.severity}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9999,
            boxShadow: 4
          }}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      )}
    </Box>
  );
};

export default FalsePositiveManagement;