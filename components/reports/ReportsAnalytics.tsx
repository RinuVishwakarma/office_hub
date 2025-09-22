'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Calendar, 
  Download, 
  Filter,
  FileText,
  Target,
  Award,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Building2
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, AttendanceRecord, LeaveRequest } from '@/lib/types';
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

const ReportsAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  
  // Data states
  const [employees, setEmployees] = useState<User[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [leaveData, setLeaveData] = useState<LeaveRequest[]>([]);

  // Predefined departments
  const departments = ['Tech', 'Media', 'Creative', 'Social Media', 'Client Services', 'Business Development', 'Consultant'];

  useEffect(() => {
    loadReportData();
  }, [dateRange, selectedDepartment]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      
      // Load employees
      const employeesSnapshot = await getDocs(collection(db, 'users'));
      const employeesList = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setEmployees(employeesList);

      // Load attendance data
      const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
      const attendanceList = attendanceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        clockIn: doc.data().clockIn?.toDate() || null,
        clockOut: doc.data().clockOut?.toDate() || null
      })) as AttendanceRecord[];
      setAttendanceData(attendanceList);

      // Load leave data
      const leaveSnapshot = await getDocs(collection(db, 'leaveRequests'));
      const leaveList = leaveSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate() || new Date(),
        requestedAt: doc.data().requestedAt?.toDate() || new Date()
      })) as LeaveRequest[];
      setLeaveData(leaveList);

    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate date range
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(dateRange));
    return { startDate, endDate };
  };

  // Filter data by department and date range
  const getFilteredEmployees = () => {
    return selectedDepartment === 'all' 
      ? employees 
      : employees.filter(emp => emp.department === selectedDepartment);
  };

  const getFilteredAttendance = () => {
    const { startDate, endDate } = getDateRange();
    const filteredEmployees = getFilteredEmployees();
    
    return attendanceData.filter(record => {
      const recordDate = new Date(record.date);
      const employeeMatch = filteredEmployees.some(emp => emp.id === record.userId);
      const dateMatch = recordDate >= startDate && recordDate <= endDate;
      return employeeMatch && dateMatch;
    });
  };

  const getFilteredLeaves = () => {
    const { startDate, endDate } = getDateRange();
    const filteredEmployees = getFilteredEmployees();
    
    return leaveData.filter(leave => {
      const employeeMatch = filteredEmployees.some(emp => emp.id === leave.userId);
      const dateMatch = leave.requestedAt >= startDate && leave.requestedAt <= endDate;
      return employeeMatch && dateMatch;
    });
  };

  // Calculate KPIs
  const calculateKPIs = () => {
    const filteredEmployees = getFilteredEmployees();
    const filteredAttendance = getFilteredAttendance();
    const filteredLeaves = getFilteredLeaves();

    const totalEmployees = filteredEmployees.length;
    const totalWorkingDays = parseInt(dateRange);
    const expectedAttendance = totalEmployees * totalWorkingDays;
    const actualAttendance = filteredAttendance.length;
    const attendanceRate = expectedAttendance > 0 ? (actualAttendance / expectedAttendance) * 100 : 0;

    const totalHours = filteredAttendance.reduce((sum, record) => sum + record.totalHours, 0);
    const avgHoursPerEmployee = totalEmployees > 0 ? totalHours / totalEmployees : 0;

    const pendingLeaves = filteredLeaves.filter(leave => leave.status === 'pending').length;
    const approvedLeaves = filteredLeaves.filter(leave => leave.status === 'approved').length;

    return {
      totalEmployees,
      attendanceRate: Math.round(attendanceRate),
      avgHoursPerEmployee: Math.round(avgHoursPerEmployee * 10) / 10,
      totalHours: Math.round(totalHours),
      pendingLeaves,
      approvedLeaves,
      totalLeaves: filteredLeaves.length
    };
  };

  // Prepare chart data
  const prepareAttendanceChartData = () => {
    const { startDate, endDate } = getDateRange();
    const days = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayAttendance = getFilteredAttendance().filter(record => record.date === dateStr);
      
      days.push({
        date: currentDate.getDate(),
        present: dayAttendance.filter(r => r.status === 'present').length,
        late: dayAttendance.filter(r => r.status === 'late').length,
        absent: getFilteredEmployees().length - dayAttendance.length
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days.slice(-14); // Show last 14 days
  };

  const prepareDepartmentData = () => {
    return departments.map(dept => {
      const deptEmployees = employees.filter(emp => emp.department === dept);
      const deptAttendance = attendanceData.filter(record => 
        deptEmployees.some(emp => emp.id === record.userId)
      );
      
      return {
        department: dept,
        employees: deptEmployees.length,
        avgHours: deptEmployees.length > 0 
          ? deptAttendance.reduce((sum, record) => sum + record.totalHours, 0) / deptEmployees.length 
          : 0,
        attendanceRate: deptEmployees.length > 0 
          ? (deptAttendance.length / (deptEmployees.length * 30)) * 100 
          : 0
      };
    });
  };

  const prepareLeaveTypeData = () => {
    const filteredLeaves = getFilteredLeaves();
    const leaveTypes = ['sick', 'vacation', 'personal', 'maternity', 'emergency'];
    
    return leaveTypes.map(type => ({
      name: type,
      value: filteredLeaves.filter(leave => leave.type === type).length,
      color: {
        sick: '#ef4444',
        vacation: '#3b82f6',
        personal: '#10b981',
        maternity: '#8b5cf6',
        emergency: '#f59e0b'
      }[type]
    })).filter(item => item.value > 0);
  };

  const exportReport = () => {
    const kpis = calculateKPIs();
    const attendanceChart = prepareAttendanceChartData();
    const departmentData = prepareDepartmentData();
    
    const reportData = {
      'Summary': [kpis],
      'Daily Attendance': attendanceChart,
      'Department Analysis': departmentData,
      'Employee Details': getFilteredEmployees().map(emp => ({
        Name: emp.name,
        Department: emp.department,
        Role: emp.role,
        'Total Hours': attendanceData
          .filter(record => record.userId === emp.id)
          .reduce((sum, record) => sum + record.totalHours, 0)
      }))
    };

    const workbook = XLSX.utils.book_new();
    
    Object.entries(reportData).forEach(([sheetName, data]) => {
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });
    
    XLSX.writeFile(workbook, `analytics_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Report exported successfully!');
  };

  const kpis = calculateKPIs();
  const attendanceChartData = prepareAttendanceChartData();
  const departmentData = prepareDepartmentData();
  const leaveTypeData = prepareLeaveTypeData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <React.Fragment>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-600 mt-1">Comprehensive insights and performance metrics</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={exportReport} variant="outline" className="border-orange-600 text-orange-600 hover:bg-orange-50">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <Label>Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 3 months</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'attendance', label: 'Attendance', icon: Clock },
              { id: 'departments', label: 'Departments', icon: Building2 },
              { id: 'performance', label: 'Performance', icon: Target }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-90">Total Employees</p>
                      <p className="text-2xl font-bold">{kpis.totalEmployees}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-90">Attendance Rate</p>
                      <p className="text-2xl font-bold">{kpis.attendanceRate}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-90">Avg Hours/Employee</p>
                      <p className="text-2xl font-bold">{kpis.avgHoursPerEmployee}h</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-90">Leave Requests</p>
                      <p className="text-2xl font-bold">{kpis.totalLeaves}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Attendance Trend</CardTitle>
                  <CardDescription>Attendance patterns over the last 14 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={attendanceChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="present" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="late" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="absent" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Leave Types Distribution</CardTitle>
                  <CardDescription>Breakdown of leave requests by type</CardDescription>
                </CardHeader>
                <CardContent>
                  {leaveTypeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={leaveTypeData}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {leaveTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      No leave data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-90">Present Days</p>
                      <p className="text-2xl font-bold">{getFilteredAttendance().filter(r => r.status === 'present').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-90">Late Arrivals</p>
                      <p className="text-2xl font-bold">{getFilteredAttendance().filter(r => r.status === 'late').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-90">Total Hours</p>
                      <p className="text-2xl font-bold">{kpis.totalHours}h</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Attendance Trends</CardTitle>
                <CardDescription>Daily attendance breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={attendanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="present" fill="#10b981" name="Present" />
                    <Bar dataKey="late" fill="#f59e0b" name="Late" />
                    <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Departments Tab */}
        {activeTab === 'departments' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Department Performance</CardTitle>
                <CardDescription>Comparative analysis across departments</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={departmentData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="department" type="category" width={120} />
                    <Tooltip />
                    <Bar dataKey="avgHours" fill="#3b82f6" name="Avg Hours" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {departmentData.map((dept) => (
                <Card key={dept.department}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Building2 className="h-8 w-8 text-orange-600" />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{dept.department}</h3>
                          <p className="text-sm text-gray-600">{dept.employees} employees</p>
                        </div>
                      </div>
                      <div className="flex space-x-6 text-center">
                        <div>
                          <p className="text-2xl font-bold text-blue-600">{dept.avgHours.toFixed(1)}h</p>
                          <p className="text-xs text-gray-500">Avg Hours</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">{dept.attendanceRate.toFixed(0)}%</p>
                          <p className="text-xs text-gray-500">Attendance</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Award className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-90">Top Performers</p>
                      <p className="text-2xl font-bold">12</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-90">Productivity Score</p>
                      <p className="text-2xl font-bold">87%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Target className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-90">Goals Met</p>
                      <p className="text-2xl font-bold">94%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-90">Cost per Employee</p>
                      <p className="text-2xl font-bold">$2.4K</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Performance Insights</CardTitle>
                <CardDescription>Key performance indicators and trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Top Performing Departments</h4>
                      <div className="space-y-2">
                        {departmentData
                          .sort((a, b) => b.avgHours - a.avgHours)
                          .slice(0, 5)
                          .map((dept, index) => (
                            <div key={dept.department} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center space-x-2">
                                <Badge variant={index === 0 ? 'default' : 'secondary'}>
                                  #{index + 1}
                                </Badge>
                                <span className="font-medium">{dept.department}</span>
                              </div>
                              <span className="text-sm text-gray-600">{dept.avgHours.toFixed(1)}h avg</span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Performance Metrics</h4>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Overall Attendance</span>
                            <span>{kpis.attendanceRate}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ width: `${kpis.attendanceRate}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Leave Approval Rate</span>
                            <span>92%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '92%' }}></div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Employee Satisfaction</span>
                            <span>88%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '88%' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </React.Fragment>
  );
};

export default ReportsAnalytics;