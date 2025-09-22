'use client';

import React, { useState } from 'react';
import { useAuth, AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

import LoginForm from '@/components/auth/LoginForm';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import ManagerDashboard from '@/components/dashboard/ManagerDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import AttendanceManagement from '@/components/attendance/AttendanceManagement';
import LeaveManagement from '@/components/leave/LeaveManagement';
import NewsEventsManager from '@/components/news/NewsEventsManager';
import EmployeeManagement from '@/components/employees/EmployeeManagement';
import DepartmentManagement from '@/components/departments/DepartmentManagement';
import Settings from '@/components/settings/Settings';
import ReportsAnalytics from '@/components/reports/ReportsAnalytics';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const renderMainContent = () => {
    if (activeTab === 'attendance') {
      return <AttendanceManagement />;
    } else if (activeTab === 'leave') {
      return <LeaveManagement />;
    } else if (activeTab === 'news') {
      return <NewsEventsManager />;
    } else if (activeTab === 'employees') {
      return <EmployeeManagement />;
    } else if (activeTab === 'departments') {
      return <DepartmentManagement />;
    } else if (activeTab === 'reports') {
      return <ReportsAnalytics />;
    } else if (activeTab === 'settings') {
      return <Settings />;
    } else if (activeTab === 'team') {
      // For managers, show team management content directly in ManagerDashboard
      return <ManagerDashboard />;
    } else if (activeTab === 'dashboard') {
      switch (user.role) {
        case 'admin':
          return <AdminDashboard />;
        case 'manager':
          return <ManagerDashboard />;
        default:
          return <EmployeeDashboard />;
      }
    }

    // Placeholder for other tabs
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
          <p className="text-gray-600">This section is under development</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 flex flex-col" style={{ marginLeft: '256px' }}>
        <TopBar />
        <main className="flex-1 p-6 overflow-auto" style={{ marginTop: '64px' }}>
          {renderMainContent()}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
      <Toaster position="top-right" />
    </AuthProvider>
  );
};

export default App;