'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Users, Building2, Calendar, TrendingUp, Clock, UserCheck, AlertTriangle, Download, Cake, Gift, PartyPopper } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, AttendanceRecord, LeaveRequest, WorkTimer } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useBirthdaySystem } from '@/hooks/useBirthdaySystem';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { 
    isBirthdayToday, 
    upcomingBirthdays, 
    showConfetti, 
    birthdayMessage,
    triggerBirthdayAnimation 
  } = useBirthdaySystem(user?.id || '');
  
  const [allEmployees, setAllEmployees] = useState<User[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState<LeaveRequest[]>([]);
  const [workTimers, setWorkTimers] = useState<WorkTimer[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    // Trigger birthday animation if it's user's birthday
    if (isBirthdayToday) {
      setTimeout(() => {
        triggerBirthdayAnimation();
      }, 1000);
    }
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load all employees
      const employeesQuery = query(collection(db, 'users'));
      const employeesSnapshot = await getDocs(employeesQuery);
      const employees = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        dateOfBirth: doc.data().dateOfBirth?.toDate() || null,
        joinDate: doc.data().joinDate?.toDate() || null
      })) as User[];
      setAllEmployees(employees);

      // Load attendance records
      const attendanceQuery = query(collection(db, 'attendance'), orderBy('date', 'desc'));
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendance = attendanceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        clockIn: doc.data().clockIn?.toDate() || null,
        clockOut: doc.data().clockOut?.toDate() || null
      })) as AttendanceRecord[];
      setAllAttendance(attendance);

      // Load leave requests
      const leaveQuery = query(collection(db, 'leaveRequests'), orderBy('requestedAt', 'desc'));
      const leaveSnapshot = await getDocs(leaveQuery);
      const leaves = leaveSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate() || new Date(),
        requestedAt: doc.data().requestedAt?.toDate() || new Date(),
        reviewedAt: doc.data().reviewedAt?.toDate() || null
      })) as LeaveRequest[];
      setAllLeaveRequests(leaves);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate KPIs
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().substring(0, 7);

  const kpis = {
    totalEmployees: allEmployees.length,
    activeEmployees: allEmployees.filter(emp => emp.isActive !== false).length,
    presentToday: allAttendance.filter(record => 
      record.date === today && record.status === 'present'
    ).length,
    avgAttendanceRate: allEmployees.filter(emp => emp.isActive !== false).length > 0 
      ? Math.round((allAttendance.filter(r => r.date === today && r.status === 'present').length / allEmployees.filter(emp => emp.isActive !== false).length) * 100)
      : 0,
    pendingLeaves: allLeaveRequests.filter(leave => leave.status === 'pending').length,
    totalHoursThisMonth: allAttendance
      .filter(record => record.date.startsWith(thisMonth))
      .reduce((sum, record) => sum + record.totalHours, 0),
    departmentCount: [...new Set(allEmployees.filter(emp => emp.department).map(emp => emp.department))].length,
  };

  // Prepare chart data
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    const dateStr = date.toISOString().split('T')[0];
    
    const dayAttendance = allAttendance.filter(record => record.date === dateStr);
    return {
      date: date.getDate(),
      present: dayAttendance.filter(r => r.status === 'present').length,
      total: allEmployees.length,
      rate: allEmployees.length > 0 
        ? Math.round((dayAttendance.filter(r => r.status === 'present').length / allEmployees.length) * 100)
        : 0
    };
  });

  const departmentData = [...new Set(allEmployees.map(emp => emp.department))]
    .map(dept => ({
      department: dept,
      employees: allEmployees.filter(emp => emp.department === dept).length,
      presentToday: allAttendance.filter(record => 
        record.date === today && 
        record.status === 'present' &&
        allEmployees.find(emp => emp.id === record.userId)?.department === dept
      ).length
    }));

  const exportAttendanceReport = () => {
    const reportData = allAttendance.map(record => {
      const employee = allEmployees.find(emp => emp.id === record.userId);
      return {
        'Employee Name': employee?.name || 'Unknown',
        'Department': employee?.department || 'Unknown',
        'Date': record.date,
        'Clock In': record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : 'N/A',
        'Clock Out': record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : 'N/A',
        'Total Hours': record.totalHours.toFixed(2),
        'Status': record.status,
        'Breaks': record.breaks.length
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');
    XLSX.writeFile(workbook, `attendance_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast.success('Attendance report exported successfully!');
  };

  const getEmployeeDetails = (employee: User) => {
    const employeeAttendance = allAttendance.filter(record => record.userId === employee.id);
    const employeeLeaves = allLeaveRequests.filter(leave => leave.userId === employee.id);
    
    const stats = {
      totalHours: employeeAttendance.reduce((sum, record) => sum + record.totalHours, 0),
      presentDays: employeeAttendance.filter(record => record.status === 'present').length,
      lateDays: employeeAttendance.filter(record => record.status === 'late').length,
      attendanceRate: employeeAttendance.length > 0 
        ? Math.round((employeeAttendance.filter(record => record.status === 'present').length / employeeAttendance.length) * 100)
        : 0,
      approvedLeaves: employeeLeaves.filter(leave => leave.status === 'approved').length,
      pendingLeaves: employeeLeaves.filter(leave => leave.status === 'pending').length
    };

    return {
      stats,
      attendance: employeeAttendance,
      leaves: employeeLeaves
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Birthday Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <div className="confetti-container">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'][Math.floor(Math.random() * 6)]
                }}
              />
            ))}
          </div>
          <style jsx>{`
            .confetti-container {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              overflow: hidden;
            }
            .confetti {
              position: absolute;
              width: 10px;
              height: 10px;
              animation: confetti-fall 3s linear infinite;
            }
            @keyframes confetti-fall {
              0% {
                transform: translateY(-100vh) rotate(0deg);
                opacity: 1;
              }
              100% {
                transform: translateY(100vh) rotate(720deg);
                opacity: 0;
              }
            }
          `}</style>
        </div>
      )}

      {/* Birthday Notification */}
      {isBirthdayToday && (
        <Card className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white border-0 shadow-2xl">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="flex space-x-2">
                <Cake className="h-8 w-8 animate-bounce" />
                <PartyPopper className="h-8 w-8 animate-pulse" />
                <Gift className="h-8 w-8 animate-bounce" style={{ animationDelay: '0.5s' }} />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">🎉 Happy Birthday! 🎉</h2>
                <p className="text-lg opacity-90">{birthdayMessage}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Company-wide overview and analytics</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={exportAttendanceReport} className="bg-orange-600 hover:bg-orange-700">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Total Employees</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis.totalEmployees}</div>
            <p className="text-orange-100">Active workforce</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5" />
              <span>Present Today</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis.presentToday}</div>
            <p className="text-green-100">{kpis.avgAttendanceRate}% attendance rate</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Pending Leaves</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis.pendingLeaves}</div>
            <p className="text-amber-100">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Departments</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis.departmentCount}</div>
            <p className="text-red-100">Active departments</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Trend (Last 30 Days)</CardTitle>
            <CardDescription>Daily attendance rate across the organization</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={last30Days}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'rate' ? `${value}%` : value,
                    name === 'rate' ? 'Attendance Rate' : 'Present'
                  ]}
                />
                <Area type="monotone" dataKey="rate" stroke="#ea580c" fill="#fed7aa" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department-wise Attendance</CardTitle>
            <CardDescription>Current attendance by department</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="department" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="presentToday" fill="#10b981" name="Present" />
                <Bar dataKey="employees" fill="#e5e7eb" name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Employee Activity</CardTitle>
            <CardDescription>Latest attendance and leave activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allAttendance.slice(0, 10).map((record) => {
                const employee = allEmployees.find(emp => emp.id === record.userId);
                return (
                  <div key={record.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {employee?.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{employee?.name}</p>
                        <p className="text-xs text-gray-500">{employee?.department}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{record.totalHours.toFixed(1)}h</p>
                      <p className="text-xs text-gray-500">{record.date}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      record.status === 'present' ? 'bg-green-100 text-green-800' :
                      record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {record.status}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Key metrics at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Monthly Hours</span>
                  <span className="text-sm font-bold">{kpis.totalHoursThisMonth.toFixed(0)}h</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-orange-600 h-2 rounded-full" 
                    style={{ width: `${Math.min((kpis.totalHoursThisMonth / (kpis.totalEmployees * 160)) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Avg Attendance</span>
                  <span className="text-sm font-bold">{kpis.avgAttendanceRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${kpis.avgAttendanceRate}%` }}
                  ></div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <Button className="w-full" variant="outline">
                  View Detailed Reports
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Cake className="h-5 w-5 text-pink-600" />
              <span>Upcoming Birthdays</span>
            </CardTitle>
            <CardDescription>Team celebrations this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingBirthdays.slice(0, 8).map((birthday) => (
                <div key={birthday.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg border border-pink-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-pink-400 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-white">
                        {birthday.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{birthday.name}</h4>
                      <p className="text-sm text-gray-600">{birthday.department} • {birthday.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-2">
                      <Cake className="h-4 w-4 text-pink-500" />
                      <span className="text-sm font-medium text-pink-600">
                        {birthday.daysUntil === 0 ? 'Today!' : `${birthday.daysUntil} days`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{birthday.date}</p>
                  </div>
                </div>
              ))}
              {upcomingBirthdays.length === 0 && (
                <div className="text-center py-6">
                  <Cake className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">No upcoming birthdays this month</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Employee Details - {selectedEmployee?.name}</DialogTitle>
            <DialogDescription>
              Comprehensive view of employee performance and attendance
            </DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6">
              {(() => {
                const details = getEmployeeDetails(selectedEmployee);
                return (
                  <>
                    {/* Employee Info */}
                    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-16 h-16 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-white">
                          {selectedEmployee.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold">{selectedEmployee.name}</h3>
                        <p className="text-gray-600">{selectedEmployee.department} • {selectedEmployee.role}</p>
                        <p className="text-sm text-gray-500">{selectedEmployee.email}</p>
                      </div>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{details.stats.totalHours.toFixed(1)}h</div>
                        <div className="text-sm text-blue-800">Total Hours</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{details.stats.attendanceRate}%</div>
                        <div className="text-sm text-green-800">Attendance Rate</div>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">{details.stats.presentDays}</div>
                        <div className="text-sm text-orange-800">Present Days</div>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{details.stats.lateDays}</div>
                        <div className="text-sm text-yellow-800">Late Days</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{details.stats.approvedLeaves}</div>
                        <div className="text-sm text-purple-800">Approved Leaves</div>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{details.stats.pendingLeaves}</div>
                        <div className="text-sm text-red-800">Pending Leaves</div>
                      </div>
                    </div>

                    {/* Recent Attendance */}
                    <div>
                      <h4 className="text-lg font-semibold mb-3">Recent Attendance</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {details.attendance.slice(0, 10).map((record) => (
                          <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium">{record.date}</div>
                              <div className="text-sm text-gray-600">
                                {record.clockIn ? record.clockIn.toLocaleTimeString() : 'N/A'} - 
                                {record.clockOut ? record.clockOut.toLocaleTimeString() : 'N/A'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{record.totalHours.toFixed(1)}h</div>
                              <div className={`text-xs px-2 py-1 rounded-full ${
                                record.status === 'present' ? 'bg-green-100 text-green-800' :
                                record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {record.status}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Leave Requests */}
                    {details.leaves.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold mb-3">Recent Leave Requests</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {details.leaves.slice(0, 5).map((leave) => (
                            <div key={leave.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <div className="font-medium">{leave.type}</div>
                                <div className="text-sm text-gray-600">
                                  {leave.startDate.toLocaleDateString()} - {leave.endDate.toLocaleDateString()}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">{leave.days} days</div>
                                <div className={`text-xs px-2 py-1 rounded-full ${
                                  leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                                  leave.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {leave.status}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;