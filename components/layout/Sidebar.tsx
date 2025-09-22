'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Clock, 
  Calendar, 
  Newspaper, 
  BarChart3, 
  Users, 
  Settings,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth();

  const getMenuItems = () => {
    const baseItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'attendance', label: 'Attendance', icon: Clock },
      { id: 'leave', label: 'Leave Management', icon: Calendar },
      { id: 'news', label: 'News & Events', icon: Newspaper }
    ];

    if (user?.role === 'admin') {
      return [
        ...baseItems,
        { id: 'employees', label: 'Employee Management', icon: Users },
        { id: 'departments', label: 'Departments', icon: Building2 },
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
        { id: 'settings', label: 'Settings', icon: Settings }
      ];
    }

    if (user?.role === 'manager') {
      return [
        ...baseItems,
        { id: 'team', label: 'Team Management', icon: Users },
        { id: 'reports', label: 'Team Reports', icon: BarChart3 }
      ];
    }

    return baseItems;
  };

  const menuItems = getMenuItems();

  return (
    <div className="w-64 bg-white shadow-lg h-screen border-r border-gray-200 fixed left-0 top-0 z-40">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-600 rounded-lg p-2">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl text-gray-900">OfficeHub</h1>
            <p className="text-sm text-gray-500 capitalize">{user?.role} Portal</p>
          </div>
        </div>
      </div>

      <nav className="p-4 overflow-y-auto" style={{ height: 'calc(100vh - 200px)' }}>
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200',
                  activeTab === item.id
                    ? 'bg-orange-50 text-orange-700 border-l-4 border-orange-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icon className={cn(
                  'h-5 w-5',
                  activeTab === item.id ? 'text-orange-700' : 'text-gray-400'
                )} />
                <span className="font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;