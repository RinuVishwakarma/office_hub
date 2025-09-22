'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  User,
  Filter,
  Search,
  Download,
  Edit,
  Trash2,
  FileText,
  CalendarDays,
  Timer,
  Users
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LeaveRequest, User as UserType } from '@/lib/types';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

// Custom Badge component
const Badge: React.FC<{ children: React.ReactNode; className?: string; variant?: string }> = ({ 
  children, 
  className = '', 
  variant = 'default' 
}) => {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  const variantClasses = {
    default: 'bg-orange-100 text-orange-800',
    secondary: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    destructive: 'bg-red-100 text-red-800'
  };
  
  return (
    <span className={`${baseClasses} ${variantClasses[variant as keyof typeof variantClasses] || variantClasses.default} ${className}`}>
      {children}
    </span>
  );
};

const LeaveManagement: React.FC = () => {
  const { user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [allEmployees, setAllEmployees] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterType, setFilterType] = useState<'all' | 'sick' | 'vacation' | 'personal' | 'maternity' | 'emergency'>('all');

  // Form state
  const [formData, setFormData] = useState({
    type: 'vacation' as 'sick' | 'vacation' | 'personal' | 'maternity' | 'emergency',
    startDate: '',
    endDate: '',
    reason: '',
    comments: ''
  });

  // Leave balance (this would typically come from a database)
  const [leaveBalance] = useState({
    sick: 10,
    vacation: 15,
    personal: 5,
    maternity: 90,
    emergency: 3
  });

  useEffect(() => {
    loadLeaveRequests();
    loadEmployees();
  }, [user?.id]);

  // Reload leave requests when employees are loaded (needed for manager filtering)
  useEffect(() => {
    if (allEmployees.length > 0 && user?.role === 'manager') {
      loadLeaveRequests();
    }
  }, [allEmployees, user?.role]);

  const loadLeaveRequests = async () => {
    try {
      setLoading(true);
      console.log('Loading leave requests for user:', user?.id, 'role:', user?.role);
      
      let q;
      if (user?.role === 'admin') {
        // Admin can see all leave requests
        q = query(collection(db, 'leaveRequests'), orderBy('requestedAt', 'desc'));
      } else if (user?.role === 'manager') {
        // Manager can see their team's leave requests - load all first, then filter
        q = query(collection(db, 'leaveRequests'));
      } else {
        // Employee can only see their own leave requests - remove orderBy to avoid index requirement
        q = query(
          collection(db, 'leaveRequests'),
          where('userId', '==', user?.id || '')
        );
      }
      
      const snapshot = await getDocs(q);
      console.log('Found', snapshot.docs.length, 'leave request documents');
      
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate() || new Date(),
        requestedAt: doc.data().requestedAt?.toDate() || new Date(),
        reviewedAt: doc.data().reviewedAt?.toDate() || null
      })) as LeaveRequest[];
      
      console.log('Processed leave requests:', requests);
      
      // Filter and sort based on role
      let filteredRequests = requests;
      
      if (user?.role === 'manager') {
        // Filter for manager's team
        filteredRequests = requests.filter(request => {
          const employee = allEmployees.find(emp => emp.id === request.userId);
          return employee?.managerId === user.id || request.userId === user.id;
        });
      }
      
      // Sort by requestedAt descending (most recent first)
      filteredRequests.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
      
      console.log('Final filtered requests:', filteredRequests);
      setLeaveRequests(filteredRequests);
    } catch (error) {
      console.error('Error loading leave requests:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const employees = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserType[];
      setAllEmployees(employees.filter(emp => emp.isActive !== false));
    } catch (error) {
      console.error('Error loading employees:', error);
      // Set empty array on error to prevent crashes
      setAllEmployees([]);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'vacation',
      startDate: '',
      endDate: '',
      reason: '',
      comments: ''
    });
  };

  const calculateDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.startDate || !formData.endDate || !formData.reason.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    
    if (startDate > endDate) {
      toast.error('End date must be after start date');
      return;
    }

    const days = calculateDays(formData.startDate, formData.endDate);

    try {
      const leaveData = {
        userId: user?.id || '',
        type: formData.type,
        startDate: startDate,
        endDate: endDate,
        days: days,
        reason: formData.reason.trim(),
        status: 'pending' as const,
        requestedAt: new Date(),
        comments: formData.comments.trim()
      };

      if (editingLeave) {
        await updateDoc(doc(db, 'leaveRequests', editingLeave.id), leaveData);
        toast.success('Leave request updated successfully!');
        setIsEditDialogOpen(false);
        setEditingLeave(null);
      } else {
        await addDoc(collection(db, 'leaveRequests'), leaveData);
        toast.success('Leave request submitted successfully!');
        setIsCreateDialogOpen(false);
      }

      resetForm();
      loadLeaveRequests();
    } catch (error) {
      console.error('Error saving leave request:', error);
      toast.error('Failed to save leave request');
    }
  };

  const handleApproveReject = async (leaveId: string, action: 'approved' | 'rejected', comments?: string) => {
    try {
      await updateDoc(doc(db, 'leaveRequests', leaveId), {
        status: action,
        reviewedBy: user?.id,
        reviewedAt: new Date(),
        comments: comments || ''
      });

      toast.success(`Leave request ${action} successfully`);
      loadLeaveRequests();
    } catch (error) {
      console.error('Error updating leave request:', error);
      toast.error('Failed to update leave request');
    }
  };

  const handleEdit = (leave: LeaveRequest) => {
    if (leave.status !== 'pending') {
      toast.error('Only pending leave requests can be edited');
      return;
    }

    setEditingLeave(leave);
    setFormData({
      type: leave.type,
      startDate: leave.startDate.toISOString().split('T')[0],
      endDate: leave.endDate.toISOString().split('T')[0],
      reason: leave.reason,
      comments: leave.comments || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'leaveRequests', id));
      toast.success('Leave request deleted successfully!');
      loadLeaveRequests();
    } catch (error) {
      console.error('Error deleting leave request:', error);
      toast.error('Failed to delete leave request');
    }
  };

  const exportLeaveData = () => {
    const exportData = leaveRequests.map(request => {
      const employee = allEmployees.find(emp => emp.id === request.userId) || 
                     (user?.id === request.userId ? user : null);
      return {
        'Employee Name': employee?.name || 'Unknown',
        'Department': employee?.department || 'Unknown',
        'Leave Type': request.type,
        'Start Date': request.startDate.toLocaleDateString(),
        'End Date': request.endDate.toLocaleDateString(),
        'Days': request.days,
        'Reason': request.reason,
        'Status': request.status,
        'Requested Date': request.requestedAt.toLocaleDateString(),
        'Comments': request.comments || 'N/A'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leave Requests');
    XLSX.writeFile(workbook, `leave_requests_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast.success('Leave data exported successfully!');
  };

  // Filter leave requests
  const filteredRequests = leaveRequests.filter(request => {
    const employee = allEmployees.find(emp => emp.id === request.userId) || 
                    (user?.id === request.userId ? user : null);
    const matchesSearch = employee?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
    const matchesType = filterType === 'all' || request.type === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'destructive';
      case 'pending': return 'warning';
      default: return 'secondary';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sick': return 'bg-red-100 text-red-800';
      case 'vacation': return 'bg-blue-100 text-blue-800';
      case 'personal': return 'bg-green-100 text-green-800';
      case 'maternity': return 'bg-purple-100 text-purple-800';
      case 'emergency': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate statistics
  const stats = {
    totalRequests: leaveRequests.length,
    pending: leaveRequests.filter(r => r.status === 'pending').length,
    approved: leaveRequests.filter(r => r.status === 'approved').length,
    rejected: leaveRequests.filter(r => r.status === 'rejected').length,
    totalDays: leaveRequests.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.days, 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-gray-600 mt-1">Manage leave requests and track time off</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => loadLeaveRequests()} variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
            <Clock className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <Button onClick={exportLeaveData} variant="outline" className="border-orange-600 text-orange-600 hover:bg-orange-50">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Request Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Request Leave</DialogTitle>
                <DialogDescription>
                  Submit a new leave request for approval
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Leave Type *</Label>
                    <Select value={formData.type} onValueChange={(value: 'sick' | 'vacation' | 'personal' | 'maternity' | 'emergency') => setFormData({...formData, type: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vacation">Vacation ({leaveBalance.vacation} days left)</SelectItem>
                        <SelectItem value="sick">Sick Leave ({leaveBalance.sick} days left)</SelectItem>
                        <SelectItem value="personal">Personal ({leaveBalance.personal} days left)</SelectItem>
                        <SelectItem value="maternity">Maternity ({leaveBalance.maternity} days left)</SelectItem>
                        <SelectItem value="emergency">Emergency ({leaveBalance.emergency} days left)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Days Requested</Label>
                    <div className="text-2xl font-bold text-orange-600 mt-2">
                      {calculateDays(formData.startDate, formData.endDate)} days
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      min={formData.startDate || new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="reason">Reason *</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    placeholder="Please provide a reason for your leave request..."
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="comments">Additional Comments</Label>
                  <Textarea
                    id="comments"
                    value={formData.comments}
                    onChange={(e) => setFormData({...formData, comments: e.target.value})}
                    placeholder="Any additional information..."
                    rows={2}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                    Submit Request
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Leave Balance Cards */}
      {user?.role === 'employee' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Object.entries(leaveBalance).map(([type, balance]) => (
            <Card key={type} className="bg-gradient-to-r from-blue-50 to-blue-100">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{balance}</div>
                  <div className="text-sm text-blue-800 capitalize">{type} Days</div>
                  <div className="text-xs text-blue-600 mt-1">Available</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Statistics Cards */}
      {(user?.role === 'admin' || user?.role === 'manager') && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <div>
                  <p className="text-sm opacity-90">Total</p>
                  <p className="text-2xl font-bold">{stats.totalRequests}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="text-sm opacity-90">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5" />
                <div>
                  <p className="text-sm opacity-90">Approved</p>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <XCircle className="h-5 w-5" />
                <div>
                  <p className="text-sm opacity-90">Rejected</p>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CalendarDays className="h-5 w-5" />
                <div>
                  <p className="text-sm opacity-90">Days Off</p>
                  <p className="text-2xl font-bold">{stats.totalDays}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search leave requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={(value: 'all' | 'pending' | 'approved' | 'rejected') => setFilterStatus(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={(value: 'all' | 'sick' | 'vacation' | 'personal' | 'maternity' | 'emergency') => setFilterType(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="sick">Sick</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="maternity">Maternity</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests */}
      <div className="grid gap-4">
        {filteredRequests.length > 0 ? (
          filteredRequests.map((request) => {
            const employee = allEmployees.find(emp => emp.id === request.userId) || 
                           (user?.id === request.userId ? user : null);
            const canEdit = request.status === 'pending' && request.userId === user?.id;
            const canApprove = (user?.role === 'admin' || user?.role === 'manager') && request.status === 'pending';
            
            return (
              <Card key={request.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-white">
                            {employee?.name?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{employee?.name || 'Unknown'}</h3>
                          <p className="text-sm text-gray-500">{employee?.department}</p>
                        </div>
                        <div className="flex space-x-2">
                          <Badge className={getTypeColor(request.type)}>
                            {request.type}
                          </Badge>
                          <Badge variant={getStatusColor(request.status)}>
                            {request.status}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>{request.startDate.toLocaleDateString()} - {request.endDate.toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Timer className="h-4 w-4" />
                          <span>{request.days} {request.days === 1 ? 'day' : 'days'}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Clock className="h-4 w-4" />
                          <span>Requested {request.requestedAt.toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-sm text-gray-700 font-medium">Reason:</p>
                        <p className="text-sm text-gray-600">{request.reason}</p>
                      </div>
                      
                      {request.comments && (
                        <div className="mb-3">
                          <p className="text-sm text-gray-700 font-medium">Comments:</p>
                          <p className="text-sm text-gray-600">{request.comments}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col space-y-2">
                      {canApprove && (
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleApproveReject(request.id, 'approved')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50"
                            onClick={() => handleApproveReject(request.id, 'rejected')}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                      
                      {canEdit && (
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(request)}
                            className="text-orange-600 border-orange-600 hover:bg-orange-50"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the leave request.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(request.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No leave requests found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {searchTerm || filterStatus !== 'all' || filterType !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Leave requests will appear here'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Leave Request</DialogTitle>
            <DialogDescription>
              Update your leave request details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-type">Leave Type *</Label>
                <Select value={formData.type} onValueChange={(value: 'sick' | 'vacation' | 'personal' | 'maternity' | 'emergency') => setFormData({...formData, type: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation">Vacation</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="maternity">Maternity</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Days Requested</Label>
                <div className="text-2xl font-bold text-orange-600 mt-2">
                  {calculateDays(formData.startDate, formData.endDate)} days
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-startDate">Start Date *</Label>
                <Input
                  id="edit-startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-endDate">End Date *</Label>
                <Input
                  id="edit-endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  min={formData.startDate}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-reason">Reason *</Label>
              <Textarea
                id="edit-reason"
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder="Please provide a reason for your leave request..."
                rows={3}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-comments">Additional Comments</Label>
              <Textarea
                id="edit-comments"
                value={formData.comments}
                onChange={(e) => setFormData({...formData, comments: e.target.value})}
                placeholder="Any additional information..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                Update Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveManagement;