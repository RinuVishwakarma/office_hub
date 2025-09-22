// TypeScript interfaces for the application
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'employee';
  department: string;
  managerId?: string;
  profileImage?: string;
  phone?: string;
  emergencyContact?: string;
  dateOfBirth?: Date | null;
  joinDate?: Date;
  address?: string;
  createdAt: Date;
  isActive?: boolean;
  firestoreId?: string; // Reference to Firestore document ID (for legacy users)
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  clockIn?: Date;
  clockOut?: Date;
  breaks: BreakRecord[];
  totalHours: number;
  status: 'present' | 'absent' | 'late' | 'half-day';
  workLocation?: string;
}

export interface BreakRecord {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  reason?: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  type: 'sick' | 'vacation' | 'personal' | 'maternity' | 'emergency';
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  comments?: string;
}

export interface NewsEvent {
  id: string;
  title: string;
  content: string;
  type: 'news' | 'event';
  priority: 'low' | 'medium' | 'high';
  publishedBy: string;
  publishedAt: Date;
  eventDate?: Date;
  isActive: boolean;
  departments: string[];
}

export interface WorkTimer {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  breakRecords: BreakRecord[];
  totalBreakTime: number;
  workLocation: string;
  status: 'active' | 'break' | 'completed';
  date: string;
}