'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkTimer } from '@/hooks/useWorkTimer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { 
  Clock, 
  Play, 
  Pause, 
  Square, 
  Coffee, 
  Calendar, 
  TrendingUp, 
  Users, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Filter,
  Search,
  Timer,
  MapPin,
  Wifi,
  WifiOff
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AttendanceRecord, User, BreakRecord } from '@/lib/types';
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

const AttendanceManagement: React.FC = () => {
  const { user } = useAuth();
  const { timer, displayTime, isActive, isPaused, startTimer, stopTimer, startBreak, endBreak } = useWorkTimer(user?.id || '');
  
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [allEmployees, setAllEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent' | 'late'>('all');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [breakReason, setBreakReason] = useState('');
  const [isBreakDialogOpen, setIsBreakDialogOpen] = useState(false);
  const [workLocation, setWorkLocation] = useState('office');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Predefined work locations
  const workLocations = [
    { value: 'office', label: 'Office' },
    { value: 'home', label: 'Work from Home' },
    { value: 'client-site', label: 'Client Site' },
    { value: 'co-working', label: 'Co-working Space' },
    { value: 'other', label: 'Other Location' }
  ];

  useEffect(() => {
    loadAttendanceData();
    loadEmployees();
    
    // Listen for online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [filterDate]);

  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      
      if (user?.role === 'admin' || user?.role === 'manager') {
        // Load all attendance records for admin/manager
        const q = query(collection(db, 'attendance'), where('date', '==', filterDate));
        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          clockIn: doc.data().clockIn?.toDate() || null,
          clockOut: doc.data().clockOut?.toDate() || null
        })) as AttendanceRecord[];
        setAttendanceRecords(records);
      } else {
        // Load only user's attendance records
        const q = query(
          collection(db, 'attendance'),
          where('userId', '==', user?.id || '')
        );
        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          clockIn: doc.data().clockIn?.toDate() || null,
          clockOut: doc.data().clockOut?.toDate() || null
        })) as AttendanceRecord[];
        // Sort by date descending and limit to 30
        setAttendanceRecords(records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30));
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    if (user?.role === 'admin' || user?.role === 'manager') {
      try {
        const q = query(collection(db, 'users'), where('isActive', '!=', false));
        const snapshot = await getDocs(q);
        const employees = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as User[];
        setAllEmployees(employees);
      } catch (error) {
        console.error('Error loading employees:', error);
      }
    }
  };

  const handleClockIn = async () => {
    try {
      await startTimer(workLocation);
      
      // Record clock in with location
      const today = new Date().toISOString().split('T')[0];
      await addDoc(collection(db, 'attendance'), {
        userId: user?.id,
        date: today,
        clockIn: new Date(),
        status: 'present',
        workLocation: workLocation,
        breaks: [],
        totalHours: 0
      });
      
      toast.success('Clocked in successfully!');
      loadAttendanceData();
    } catch (error) {
      console.error('Clock in error:', error);
      toast.error('Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    try {
      const totalTime = await stopTimer();
      const hours = Math.round((totalTime || 0) / (1000 * 60 * 60) * 100) / 100;
      
      // Update attendance record
      const today = new Date().toISOString().split('T')[0];
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('userId', '==', user?.id),
        where('date', '==', today)
      );
      const snapshot = await getDocs(attendanceQuery);
      
      if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref;
        await updateDoc(docRef, {
          clockOut: new Date(),
          totalHours: hours,
          breaks: timer?.breakRecords || []
        });
      }
      
      toast.success(`Clocked out! Total work time: ${hours} hours`);
      loadAttendanceData();
    } catch (error) {
      console.error('Clock out error:', error);
      toast.error('Failed to clock out. Please try again.');
    }
  };

  const handleStartBreak = async () => {
    try {
      await startBreak(breakReason || 'General break');
      toast.success('Break started');
      setBreakReason('');
      setIsBreakDialogOpen(false);
    } catch (error) {
      console.error('Break start error:', error);
      toast.error('Failed to start break');
    }
  };

  const handleEndBreak = async () => {
    try {
      await endBreak();
      toast.success('Break ended, back to work!');
    } catch (error) {
      console.error('Break end error:', error);
      toast.error('Failed to end break');
    }
  };

  const exportAttendanceData = () => {
    const exportData = attendanceRecords.map(record => {
      const employee = allEmployees.find(emp => emp.id === record.userId);
      return {
        'Employee Name': employee?.name || 'Unknown',
        'Department': employee?.department || 'Unknown',
        'Date': record.date,
        'Clock In': record.clockIn ? record.clockIn.toLocaleTimeString() : 'N/A',
        'Clock Out': record.clockOut ? record.clockOut.toLocaleTimeString() : 'N/A',
        'Total Hours': record.totalHours.toFixed(2),
        'Status': record.status,
        'Breaks': record.breaks?.length || 0
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
    XLSX.writeFile(workbook, `attendance_${filterDate}.xlsx`);
    
    toast.success('Attendance data exported successfully!');
  };

  // Filter attendance records
  const filteredRecords = attendanceRecords.filter(record => {
    const employee = allEmployees.find(emp => emp.id === record.userId);
    const matchesSearch = employee?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee?.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || record.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const stats = {
    totalPresent: attendanceRecords.filter(r => r.status === 'present').length,
    totalLate: attendanceRecords.filter(r => r.status === 'late').length,
    totalAbsent: allEmployees.length - attendanceRecords.length,
    avgHours: attendanceRecords.length > 0 
      ? attendanceRecords.reduce((sum, r) => sum + r.totalHours, 0) / attendanceRecords.length 
      : 0
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'success';
      case 'late': return 'warning';
      case 'absent': return 'destructive';
      default: return 'secondary';
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-600 mt-1">Track work hours and manage attendance</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-sm">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-600">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-red-600">Offline</span>
              </>
            )}
          </div>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <Button onClick={exportAttendanceData} variant="outline" className="border-orange-600 text-orange-600 hover:bg-orange-50">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Employee Time Tracker */}
      {user?.role === 'employee' && (
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Timer className="h-6 w-6" />
              <span>Work Timer</span>
            </CardTitle>
            <CardDescription className="text-blue-100">
              Track your daily work hours with precision
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-4xl font-bold mb-2">{displayTime}</div>
                <div className="flex space-x-2">
                  {!isActive ? (
                    <Button onClick={handleClockIn} variant="secondary" size="sm" disabled={!isOnline}>
                      <Play className="h-4 w-4 mr-1" />
                      Clock In
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleClockOut} variant="secondary" size="sm">
                        <Square className="h-4 w-4 mr-1" />
                        Clock Out
                      </Button>
                      {!isPaused ? (
                        <Dialog open={isBreakDialogOpen} onOpenChange={setIsBreakDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                              <Coffee className="h-4 w-4 mr-1" />
                              Start Break
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Start Break</DialogTitle>
                              <DialogDescription>
                                What type of break are you taking?
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="breakReason">Break Reason (Optional)</Label>
                                <Select value={breakReason} onValueChange={setBreakReason}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select break type..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="lunch">Lunch Break</SelectItem>
                                    <SelectItem value="coffee">Coffee Break</SelectItem>
                                    <SelectItem value="personal">Personal Break</SelectItem>
                                    <SelectItem value="meeting">Meeting</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsBreakDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleStartBreak} className="bg-orange-600 hover:bg-orange-700">
                                Start Break
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <Button onClick={handleEndBreak} variant="outline" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                          <Play className="h-4 w-4 mr-1" />
                          End Break
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="mb-2">
                  <select
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                    className="bg-white/20 border border-white/30 text-white text-sm rounded px-2 py-1"
                    disabled={isActive}
                  >
                    {workLocations.map(location => (
                      <option key={location.value} value={location.value} className="text-gray-900">
                        {location.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-lg font-semibold">Today</div>
                <div className="text-blue-100">{new Date().toLocaleDateString()}</div>
              </div>
            </div>
            {isPaused && (
              <div className="mt-4 p-3 bg-white/10 rounded-lg">
                <div className="flex items-center space-x-2 text-yellow-200">
                  <Coffee className="h-4 w-4" />
                  <span className="text-sm">You're currently on a {breakReason || 'break'}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      {(user?.role === 'admin' || user?.role === 'manager') && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5" />
                <div>
                  <p className="text-sm opacity-90">Present</p>
                  <p className="text-2xl font-bold">{stats.totalPresent}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="text-sm opacity-90">Late</p>
                  <p className="text-2xl font-bold">{stats.totalLate}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <XCircle className="h-5 w-5" />
                <div>
                  <p className="text-sm opacity-90">Absent</p>
                  <p className="text-2xl font-bold">{stats.totalAbsent}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <div>
                  <p className="text-sm opacity-90">Avg Hours</p>
                  <p className="text-2xl font-bold">{stats.avgHours.toFixed(1)}h</p>
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
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-40"
                />
              )}
              <Select value={filterStatus} onValueChange={(value: 'all' | 'present' | 'absent' | 'late') => setFilterStatus(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Records */}
      <div className="grid gap-4">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => {
            const employee = allEmployees.find(emp => emp.id === record.userId) || 
                           (user?.id === record.userId ? user : null);
            
            return (
              <Card key={record.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold text-white">
                          {employee?.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{employee?.name || 'Unknown'}</h3>
                          <Badge variant={getStatusColor(record.status)}>
                            {record.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4" />
                            <span>In: {record.clockIn ? record.clockIn.toLocaleTimeString() : 'N/A'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4" />
                            <span>Out: {record.clockOut ? record.clockOut.toLocaleTimeString() : 'N/A'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Timer className="h-4 w-4" />
                            <span>Total: {record.totalHours.toFixed(1)}h</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Coffee className="h-4 w-4" />
                            <span>Breaks: {record.breaks?.length || 0}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4" />
                            <span>Location: {record.workLocation || 'Office'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-gray-500">{employee?.department}</div>
                      <div className="text-xs text-gray-400 mt-1">{record.date}</div>
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
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No attendance records found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {searchTerm || filterStatus !== 'all' 
                    ? 'Try adjusting your filters' 
                    : 'Attendance records will appear here'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AttendanceManagement;