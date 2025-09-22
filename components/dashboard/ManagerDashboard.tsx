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
  Users, 
  Clock, 
  Calendar, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Cake, 
  Gift, 
  PartyPopper,
  Play,
  Square,
  Coffee,
  Timer,
  MapPin,
  UserCheck,
  Building2,
  BarChart3,
  Mail,
  Phone,
  FileText,
  Download,
  Eye,
  Edit,
  Target,
  Award
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, AttendanceRecord, LeaveRequest, NewsEvent } from '@/lib/types';
import { useBirthdaySystem } from '@/hooks/useBirthdaySystem';
import toast from 'react-hot-toast';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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

interface CompanyPolicy {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  category: string;
  uploadedAt: Date;
  uploadedBy: string;
}

interface Holiday {
  id: string;
  name: string;
  date: Date;
  type: 'public' | 'company' | 'optional';
  description?: string;
}

const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { timer, displayTime, isActive, isPaused, startTimer, stopTimer, startBreak, endBreak } = useWorkTimer(user?.id || '');
  const { 
    isBirthdayToday, 
    upcomingBirthdays, 
    showConfetti, 
    birthdayMessage,
    triggerBirthdayAnimation 
  } = useBirthdaySystem(user?.id || '');
  
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [teamAttendance, setTeamAttendance] = useState<AttendanceRecord[]>([]);
  const [policies, setPolicies] = useState<CompanyPolicy[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [recentNews, setRecentNews] = useState<NewsEvent[]>([]);
  const [activeTab, setActiveTab] = useState('team');
  const [breakReason, setBreakReason] = useState('');
  const [isBreakDialogOpen, setIsBreakDialogOpen] = useState(false);
  const [workLocation, setWorkLocation] = useState('office');
  const [selectedTeamMember, setSelectedTeamMember] = useState<User | null>(null);
  const [isTeamMemberDialogOpen, setIsTeamMemberDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadPoliciesAndHolidays();
    if (user?.id) {
      loadTeamData();
      
      // Trigger birthday animation if it's user's birthday
      if (isBirthdayToday) {
        setTimeout(() => {
          triggerBirthdayAnimation();
        }, 1000);
      }
    }
  }, [user?.id]);

  // Reload policies and holidays every 30 seconds to sync with admin changes
  useEffect(() => {
    const interval = setInterval(() => {
      loadPoliciesAndHolidays();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadPoliciesAndHolidays = async () => {
    try {
      // Load policies from Firebase
      const policiesQuery = query(collection(db, 'companyPolicies'));
      const policiesSnapshot = await getDocs(policiesQuery);
      const policiesList = policiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploadedAt: doc.data().uploadedAt?.toDate() || new Date()
      })) as CompanyPolicy[];
      setPolicies(policiesList.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()));

      // Load holidays from Firebase
      const holidaysQuery = query(collection(db, 'companyHolidays'));
      const holidaysSnapshot = await getDocs(holidaysQuery);
      const holidaysList = holidaysSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      })) as Holiday[];
      setHolidays(holidaysList.sort((a, b) => a.date.getTime() - b.date.getTime()));
    } catch (error) {
      console.error('Error loading policies and holidays:', error);
      setPolicies([]);
      setHolidays([]);
    }
  };

  const loadTeamData = async () => {
    if (!user?.id) return;

    try {
      // Load team members
      const teamQuery = query(collection(db, 'users'));
      const teamSnapshot = await getDocs(teamQuery);
      const allUsers = teamSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      
      // Filter team members on client side
      const team = allUsers.filter(emp => emp.managerId === user.id && emp.isActive === true);
      setTeamMembers(team);

      // Load pending leave requests
      const leaveQuery = query(collection(db, 'leaveRequests'));
      const leaveSnapshot = await getDocs(leaveQuery);
      const leaves = leaveSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate() || new Date(),
        requestedAt: doc.data().requestedAt?.toDate() || new Date(),
        reviewedAt: doc.data().reviewedAt?.toDate() || null
      })) as LeaveRequest[];
      
      // Filter for team members and pending status only
      const teamLeaves = leaves.filter(leave => 
        leave.status === 'pending' && team.some(member => member.id === leave.userId)
      );
      setPendingLeaves(teamLeaves);

      // Load team attendance for this month
      const attendanceQuery = query(collection(db, 'attendance'));
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendance = attendanceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        clockIn: doc.data().clockIn?.toDate() || new Date(),
        clockOut: doc.data().clockOut?.toDate() || null
      })) as AttendanceRecord[];
      
      const teamAttendanceData = attendance.filter(record => 
        team.some(member => member.id === record.userId)
      );
      setTeamAttendance(teamAttendanceData);

      // Load recent news
      const newsQuery = query(collection(db, 'newsEvents'));
      const newsSnapshot = await getDocs(newsQuery);
      const news = newsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        publishedAt: doc.data().publishedAt?.toDate() || new Date(),
        eventDate: doc.data().eventDate?.toDate() || null
      })) as NewsEvent[];
      
      const filteredNews = news.filter(item => 
        item.isActive && (item.departments.includes('all') || item.departments.includes(user.department))
      ).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, 5);
      
      setRecentNews(filteredNews);

    } catch (error) {
      console.error('Error loading team data:', error);
      toast.error('Failed to load team data');
    }
  };

  const handleClockIn = async () => {
    try {
      await startTimer();
      
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
    } catch (error) {
      console.error('Clock in error:', error);
      toast.error('Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    try {
      const totalTime = await stopTimer();
      const hours = Math.round((totalTime || 0) / (1000 * 60 * 60) * 100) / 100;
      
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
    } catch (error) {
      console.error('Clock out error:', error);
      toast.error('Failed to clock out');
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

  const handleLeaveAction = async (leaveId: string, action: 'approved' | 'rejected', comments?: string) => {
    try {
      await updateDoc(doc(db, 'leaveRequests', leaveId), {
        status: action,
        reviewedBy: user?.id,
        reviewedAt: new Date(),
        comments: comments || ''
      });

      toast.success(`Leave request ${action} successfully`);
      loadTeamData(); // Reload data
    } catch (error) {
      console.error('Error updating leave request:', error);
      toast.error('Failed to update leave request');
    }
  };

  const handleDownloadPolicy = async (policy: CompanyPolicy) => {
    try {
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      
      // Get fonts
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helveticaObliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
      
      // Helper function to wrap text
      const wrapText = (text: string, font: any, fontSize: number, maxWidth: number) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = font.widthOfTextAtSize(testLine, fontSize);
          
          if (testWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        
        if (currentLine) {
          lines.push(currentLine);
        }
        
        return lines;
      };

      // Helper function to create a new page
      const createNewPage = () => {
        const page = pdfDoc.addPage([612, 792]); // Standard letter size
        const { width, height } = page.getSize();
        
        // Add header to every page
        page.drawRectangle({
          x: 50,
          y: height - 120,
          width: width - 100,
          height: 60,
          borderColor: rgb(0.8, 0.4, 0),
          borderWidth: 2,
        });
        
        page.drawText('OFFICEHUB TECHNOLOGIES', {
          x: width / 2 - 90,
          y: height - 85,
          size: 18,
          font: helveticaBoldFont,
          color: rgb(0.8, 0.4, 0),
        });
        
        page.drawText('COMPANY POLICY DOCUMENT', {
          x: width / 2 - 90,
          y: height - 105,
          size: 12,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        
        return { page, width, height, currentY: height - 180 };
      };

      // Helper function to add section with page break logic
      const addSection = (title: string, content: string[], pageState: any) => {
        let { page, width, height, currentY } = pageState;
        
        // Check if we need a new page for the title
        if (currentY < 100) {
          pageState = createNewPage();
          page = pageState.page;
          width = pageState.width;
          height = pageState.height;
          currentY = pageState.currentY;
        }
        
        // Section title
        page.drawText(title, {
          x: 50,
          y: currentY,
          size: 14,
          font: helveticaBoldFont,
          color: rgb(0.8, 0.4, 0),
        });
        
        currentY -= 25;
        
        // Section content
        for (const item of content) {
          // Check if we need a new page
          if (currentY < 80) {
            pageState = createNewPage();
            page = pageState.page;
            width = pageState.width;
            height = pageState.height;
            currentY = pageState.currentY;
          }
          
          const lines = wrapText(item, helveticaFont, 10, width - 100);
          
          for (const line of lines) {
            // Check if we need a new page for this line
            if (currentY < 50) {
              pageState = createNewPage();
              page = pageState.page;
              width = pageState.width;
              height = pageState.height;
              currentY = pageState.currentY;
            }
            
            page.drawText(line, {
              x: 50,
              y: currentY,
              size: 10,
              font: helveticaFont,
              color: rgb(0, 0, 0),
            });
            
            currentY -= 12;
          }
          
          currentY -= 8; // Space between paragraphs
        }
        
        currentY -= 30; // Space between sections
        pageState.currentY = currentY;
        return pageState;
      };
      
      // Create first page
      let pageState = createNewPage();
      const { page, width, height } = pageState;
      
      // Document Information Section
      const documentInfo = [
        `Document Title: ${policy.title}`,
        `Document Category: ${policy.category.toUpperCase()}`,
        `Document ID: POL-${policy.id.substring(0, 8).toUpperCase()}`,
        `Version: 1.0`,
        `Effective Date: ${policy.uploadedAt.toLocaleDateString()}`,
        `Review Date: ${new Date(policy.uploadedAt.getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
        `Document Owner: ${policy.uploadedBy}`,
        `Status: Active and Enforceable`
      ];
      
      pageState = addSection('DOCUMENT INFORMATION', documentInfo, pageState);
      
      // Policy Overview Section
      const overviewContent = [
        policy.description,
        '',
        'This policy document has been created to establish clear guidelines and procedures for all employees, contractors, and stakeholders associated with OfficeHub Technologies. It is imperative that all personnel familiarize themselves with the contents of this document and ensure full compliance.',
        '',
        'The policy outlined herein is designed to maintain the highest standards of professional conduct, operational efficiency, and legal compliance across all organizational activities.'
      ];
      
      pageState = addSection('POLICY OVERVIEW', overviewContent, pageState);
      
      // Detailed Policy Content Section
      const detailedContent = [
        '1. SCOPE AND APPLICABILITY',
        'This policy applies to all employees, contractors, temporary workers, consultants, and any other individuals who perform work for or on behalf of OfficeHub Technologies.',
        '',
        '2. POLICY STATEMENT',
        'OfficeHub Technologies is committed to maintaining the highest standards of integrity, professionalism, and ethical conduct in all business operations. This policy serves as a comprehensive guide to ensure consistent application of organizational standards.',
        '',
        '3. RESPONSIBILITIES',
        'All personnel are responsible for:',
        '• Understanding and adhering to the guidelines outlined in this policy',
        '• Reporting any violations or concerns to appropriate management',
        '• Participating in training and awareness programs as required',
        '• Maintaining confidentiality of sensitive information',
        '',
        '4. COMPLIANCE AND MONITORING',
        'Regular audits and assessments will be conducted to ensure compliance with this policy. Non-compliance may result in disciplinary action, up to and including termination of employment or contract.',
        '',
        '5. POLICY REVIEW AND UPDATES',
        'This policy will be reviewed annually or as required by changes in legislation, industry standards, or organizational requirements. Updates will be communicated to all relevant personnel.'
      ];
      
      pageState = addSection('DETAILED POLICY CONTENT', detailedContent, pageState);
      
      // Implementation Guidelines Section
      const implementationContent = [
        'To ensure effective implementation of this policy, the following guidelines should be followed:',
        '',
        '1. Communication: All new employees must be provided with a copy of this policy during orientation.',
        '2. Training: Regular training sessions will be conducted to reinforce policy understanding.',
        '3. Documentation: All policy-related activities must be properly documented.',
        '4. Monitoring: Continuous monitoring will ensure policy effectiveness.',
        '5. Feedback: Employee feedback is encouraged to improve policy implementation.',
        '',
        'For questions or clarifications regarding this policy, please contact:',
        '• Human Resources Department: hr@officehub.com',
        '• Policy Compliance Officer: compliance@officehub.com',
        '• Direct Manager or Supervisor'
      ];
      
      pageState = addSection('IMPLEMENTATION GUIDELINES', implementationContent, pageState);
      
      // Legal and Compliance Section
      const legalContent = [
        'This policy document is governed by applicable local, state, and federal laws. In case of any conflict between this policy and applicable law, the law shall prevail.',
        '',
        'Key Legal Considerations:',
        '• Employment Law Compliance',
        '• Data Protection and Privacy Regulations',
        '• Industry-Specific Regulations',
        '• Health and Safety Standards',
        '• Anti-Discrimination Laws',
        '',
        'This document constitutes a legally binding policy and must be adhered to by all personnel.'
      ];
      
      pageState = addSection('LEGAL AND COMPLIANCE', legalContent, pageState);
      
      // Signature Section - ensure it's on a new page if needed
      if (pageState.currentY < 150) {
        pageState = createNewPage();
      }
      
      let { page: finalPage, width: finalWidth, height: finalHeight, currentY } = pageState;
      
      // Signature Section
      finalPage.drawLine({
        start: { x: 50, y: currentY + 40 },
        end: { x: finalWidth - 50, y: currentY + 40 },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
      
      finalPage.drawText('AUTHORIZED SIGNATURE', {
        x: 50,
        y: currentY + 20,
        size: 10,
        font: helveticaBoldFont,
        color: rgb(0, 0, 0),
      });
      
      finalPage.drawText('Date: _______________', {
        x: 50,
        y: currentY + 5,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      
      finalPage.drawText('Signature: _______________', {
        x: 300,
        y: currentY + 5,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      
      // Footer with multiple lines
      const footerText = [
        `© ${new Date().getFullYear()} OfficeHub Technologies. All rights reserved.`,
        'This document contains confidential and proprietary information.',
        'Unauthorized distribution is strictly prohibited.',
        `Generated on: ${new Date().toLocaleString()}`,
        'Document Classification: Internal Use Only'
      ];
      
      footerText.forEach((text, index) => {
        finalPage.drawText(text, {
          x: 50,
          y: 30 - (index * 10),
          size: 8,
          font: helveticaObliqueFont,
          color: rgb(0.5, 0.5, 0.5),
        });
      });
      
      // Serialize the PDF
      const pdfBytes = await pdfDoc.save();
      
      // Create download link
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${policy.title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Policy downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const viewTeamMemberDetails = (member: User) => {
    setSelectedTeamMember(member);
    setIsTeamMemberDialogOpen(true);
  };

  // Calculate team statistics
  const teamStats = {
    totalMembers: teamMembers.length,
    presentToday: teamAttendance.filter(record => 
      record.date === new Date().toISOString().split('T')[0] && 
      record.status === 'present'
    ).length,
    avgHoursThisWeek: teamAttendance.length > 0 
      ? teamAttendance.reduce((sum, record) => sum + record.totalHours, 0) / teamAttendance.length 
      : 0,
    pendingLeaves: pendingLeaves.length
  };

  // Prepare chart data
  const weeklyAttendanceData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().split('T')[0];
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    
    const dayAttendance = teamAttendance.filter(record => record.date === dateStr);
    return {
      day: dayName,
      present: dayAttendance.filter(r => r.status === 'present').length,
      late: dayAttendance.filter(r => r.status === 'late').length,
      absent: teamMembers.length - dayAttendance.length
    };
  });

  const leaveTypeData = [
    { name: 'Sick', value: pendingLeaves.filter(l => l.type === 'sick').length, color: '#ef4444' },
    { name: 'Vacation', value: pendingLeaves.filter(l => l.type === 'vacation').length, color: '#3b82f6' },
    { name: 'Personal', value: pendingLeaves.filter(l => l.type === 'personal').length, color: '#10b981' },
    { name: 'Emergency', value: pendingLeaves.filter(l => l.type === 'emergency').length, color: '#f59e0b' }
  ].filter(item => item.value > 0);

  return (
    <>
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
          <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-600 mt-1">Monitor and manage your team's performance</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Team Size</p>
          <p className="text-2xl font-bold text-blue-600">{teamStats.totalMembers}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'team', label: 'Team Management', icon: Users },
            { id: 'timer', label: 'Work Timer', icon: Timer },
            { id: 'policies', label: 'Company Policies', icon: FileText },
            { id: 'calendar', label: 'Holiday Calendar', icon: Calendar }
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
      {/* Team Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span>Team Members</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{teamStats.totalMembers}</div>
            <p className="text-sm text-gray-600">Active employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Present Today</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{teamStats.presentToday}</div>
            <p className="text-sm text-gray-600">
              {teamStats.totalMembers > 0 
                ? `${Math.round((teamStats.presentToday / teamStats.totalMembers) * 100)}% attendance`
                : 'No data'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <span>Avg Hours/Week</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{teamStats.avgHoursThisWeek.toFixed(1)}h</div>
            <p className="text-sm text-gray-600">Team average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <span>Pending Leaves</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{teamStats.pendingLeaves}</div>
            <p className="text-sm text-gray-600">Awaiting approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Attendance Trend</CardTitle>
            <CardDescription>Team attendance over the past 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300} as any>
              <BarChart data={weeklyAttendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="present" fill="#10b981" name="Present" />
                <Bar dataKey="late" fill="#f59e0b" name="Late" />
                <Bar dataKey="absent" fill="#ef4444" name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave Requests by Type</CardTitle>
            <CardDescription>Distribution of pending leave requests</CardDescription>
          </CardHeader>
          <CardContent>
            {leaveTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300} as any>
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
                No pending leave requests
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Cake className="h-5 w-5 text-pink-600" />
              <span>Team Birthdays</span>
            </CardTitle>
            <CardDescription>Upcoming celebrations in your team</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingBirthdays.slice(0, 6).map((birthday) => (
                <div key={birthday.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg border border-pink-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-pink-400 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-white">
                        {birthday.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{birthday.name}</h4>
                      <p className="text-sm text-gray-600">{birthday.department}</p>
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
                  <p className="text-gray-500 text-sm">No upcoming team birthdays</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Leave Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Pending Leave Requests</span>
          </CardTitle>
          <CardDescription>Review and approve leave requests from your team</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingLeaves.length > 0 ? (
            <div className="space-y-4">
              {pendingLeaves.map((leave) => {
                const employee = teamMembers.find(member => member.id === leave.userId);
                return (
                  <div key={leave.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-gray-900">{employee?.name}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            leave.type === 'sick' ? 'bg-red-100 text-red-800' :
                            leave.type === 'vacation' ? 'bg-blue-100 text-blue-800' :
                            leave.type === 'personal' ? 'bg-green-100 text-green-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {leave.type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {leave.startDate.toLocaleDateString()} - {leave.endDate.toLocaleDateString()}
                          <span className="ml-2">({leave.days} {leave.days === 1 ? 'day' : 'days'})</span>
                        </p>
                        <p className="text-sm text-gray-700 mt-2">{leave.reason}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50"
                          onClick={() => handleLeaveAction(leave.id, 'approved')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => handleLeaveAction(leave.id, 'rejected')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No pending leave requests</p>
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      )}

      {/* Team Management Tab */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Team Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{teamMembers.length}</div>
                    <div className="text-blue-100 text-sm">Team Members</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{teamMembers.filter(m => m.isActive).length}</div>
                    <div className="text-green-100 text-sm">Active</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{teamStats.presentToday}</div>
                    <div className="text-orange-100 text-sm">Present Today</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{Math.round((teamStats.presentToday / teamMembers.length) * 100) || 0}%</div>
                    <div className="text-purple-100 text-sm">Attendance Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Performance Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-orange-600" />
                  <span>Team Performance Overview</span>
                </CardTitle>
                <CardDescription>Weekly performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="font-medium">Excellent Performers</span>
                    </div>
                    <div className="text-green-600 font-bold">
                      {Math.floor(teamMembers.length * 0.3)} members
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="font-medium">Good Performers</span>
                    </div>
                    <div className="text-blue-600 font-bold">
                      {Math.floor(teamMembers.length * 0.5)} members
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span className="font-medium">Needs Improvement</span>
                    </div>
                    <div className="text-yellow-600 font-bold">
                      {Math.floor(teamMembers.length * 0.2)} members
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Award className="h-5 w-5 text-orange-600" />
                  <span>Team Achievements</span>
                </CardTitle>
                <CardDescription>Recent accomplishments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gold-50 to-yellow-50 rounded-lg border border-yellow-200">
                    <Award className="h-5 w-5 text-yellow-600" />
                    <div>
                      <div className="font-medium text-gray-900">Perfect Attendance</div>
                      <div className="text-sm text-gray-600">3 team members this month</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <Target className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-gray-900">Goals Achieved</div>
                      <div className="text-sm text-gray-600">95% team goal completion</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium text-gray-900">Project Delivery</div>
                      <div className="text-sm text-gray-600">On-time delivery streak: 12 days</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Members Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-orange-600" />
                  <span>Team Members</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Search team members..."
                    className="w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </CardTitle>
              <CardDescription>Manage and monitor your team members</CardDescription>
            </CardHeader>
            <CardContent>
              {teamMembers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {teamMembers
                    .filter(member => 
                      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      member.email.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((member) => {
                      const memberAttendance = teamAttendance.filter(record => record.userId === member.id);
                      const todayAttendance = memberAttendance.find(record => 
                        record.date === new Date().toISOString().split('T')[0]
                      );
                      const attendanceRate = memberAttendance.length > 0 
                        ? Math.round((memberAttendance.filter(r => r.status === 'present').length / memberAttendance.length) * 100)
                        : 0;
                      
                      return (
                        <Card key={member.id} className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-orange-500">
                          <CardContent className="pt-6">
                            <div className="text-center mb-4">
                              <div className="w-16 h-16 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-xl font-bold text-white">
                                  {member.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">{member.name}</h3>
                              <div className="flex items-center justify-center space-x-2 mb-2">
                                <Badge className="bg-blue-100 text-blue-800">
                                  {member.role}
                                </Badge>
                                <Badge variant={member.isActive ? "success" : "destructive"}>
                                  {member.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            </div>

                            {/* Contact Info */}
                            <div className="space-y-2 mb-4">
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Mail className="h-4 w-4" />
                                <span className="truncate">{member.email}</span>
                              </div>
                              {member.phone && (
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <Phone className="h-4 w-4" />
                                  <span>{member.phone}</span>
                                </div>
                              )}
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Building2 className="h-4 w-4" />
                                <span>{member.department}</span>
                              </div>
                            </div>

                            {/* Performance Metrics */}
                            <div className="bg-gray-50 rounded-lg p-3 mb-4">
                              <div className="grid grid-cols-2 gap-3 text-center">
                                <div>
                                  <div className="text-lg font-bold text-green-600">{attendanceRate}%</div>
                                  <div className="text-xs text-gray-500">Attendance</div>
                                </div>
                                <div>
                                  <div className="text-lg font-bold text-blue-600">
                                    {memberAttendance.reduce((sum, record) => sum + record.totalHours, 0).toFixed(0)}h
                                  </div>
                                  <div className="text-xs text-gray-500">Total Hours</div>
                                </div>
                              </div>
                            </div>

                            {/* Today's Status */}
                            <div className="mb-4">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Today's Status:</span>
                                {todayAttendance ? (
                                  <Badge variant={
                                    todayAttendance.status === 'present' ? 'success' :
                                    todayAttendance.status === 'late' ? 'warning' : 'destructive'
                                  }>
                                    {todayAttendance.status}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">Not clocked in</Badge>
                                )}
                              </div>
                              {todayAttendance && (
                                <div className="text-xs text-gray-500 mt-1">
                                  In: {todayAttendance.clockIn?.toLocaleTimeString() || 'N/A'} | 
                                  Out: {todayAttendance.clockOut?.toLocaleTimeString() || 'Working'}
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => viewTeamMemberDetails(member)}
                                className="flex-1 text-blue-600 border-blue-600 hover:bg-blue-50"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 border-green-600 hover:bg-green-50"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Team Members</h3>
                  <p className="text-gray-500">You don't have any team members assigned yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Work Timer Tab */}
      {activeTab === 'timer' && (
        <div className="space-y-6">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Timer className="h-6 w-6" />
                <span>Manager Work Timer</span>
              </CardTitle>
              <CardDescription className="text-blue-100">
                Track your daily work hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4xl font-bold mb-2">{displayTime}</div>
                  <div className="flex space-x-2">
                    {!isActive ? (
                      <Button onClick={handleClockIn} variant="secondary" size="sm">
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
                                  <Label htmlFor="breakReason">Break Reason</Label>
                                  <Select value={breakReason} onValueChange={setBreakReason}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select break type..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="lunch">Lunch Break</SelectItem>
                                      <SelectItem value="coffee">Coffee Break</SelectItem>
                                      <SelectItem value="meeting">Meeting</SelectItem>
                                      <SelectItem value="personal">Personal Break</SelectItem>
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
                      <option value="office" className="text-gray-900">Office</option>
                      <option value="home" className="text-gray-900">Work from Home</option>
                      <option value="client-site" className="text-gray-900">Client Site</option>
                      <option value="other" className="text-gray-900">Other Location</option>
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
        </div>
      )}

      {/* Company Policies Tab */}
      {activeTab === 'policies' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Company Policies</h2>
            <div className="grid gap-4">
              {policies.map((policy) => (
                <Card key={policy.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <FileText className="h-5 w-5 text-orange-600" />
                          <h3 className="text-lg font-semibold text-gray-900">{policy.title}</h3>
                          <Badge className="bg-blue-100 text-blue-800">
                            {policy.category}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-3">{policy.description}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Uploaded by {policy.uploadedBy}</span>
                          <span>•</span>
                          <span>{policy.uploadedAt.toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-blue-600 border-blue-600 hover:bg-blue-50"
                          onClick={() => handleDownloadPolicy(policy)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Holiday Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Holiday Calendar</h2>
            <div className="grid gap-4">
              {holidays.map((holiday) => (
                <Card key={holiday.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Calendar className="h-5 w-5 text-orange-600" />
                        <div>
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">{holiday.name}</h3>
                            <Badge className={
                              holiday.type === 'public' ? 'bg-blue-100 text-blue-800' :
                              holiday.type === 'company' ? 'bg-orange-100 text-orange-800' :
                              'bg-green-100 text-green-800'
                            }>
                              {holiday.type}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span className="font-medium">{holiday.date.toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}</span>
                            {holiday.description && (
                              <>
                                <span>•</span>
                                <span>{holiday.description}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Team Member Details Dialog */}
      <Dialog open={isTeamMemberDialogOpen} onOpenChange={setIsTeamMemberDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Team Member Details</DialogTitle>
            <DialogDescription>
              Complete information about {selectedTeamMember?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedTeamMember && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-orange-50 to-blue-50 rounded-lg">
                <div className="w-16 h-16 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {selectedTeamMember.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedTeamMember.name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge className="bg-blue-100 text-blue-800">
                      {selectedTeamMember.role}
                    </Badge>
                    <Badge variant={selectedTeamMember.isActive ? "success" : "destructive"}>
                      {selectedTeamMember.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Email Address</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{selectedTeamMember.email}</span>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Department</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span>{selectedTeamMember.department}</span>
                    </div>
                  </div>

                  {selectedTeamMember.phone && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Phone Number</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{selectedTeamMember.phone}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Join Date</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{selectedTeamMember.createdAt ? selectedTeamMember.createdAt.toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>

                  {selectedTeamMember.address && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Address</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>{selectedTeamMember.address}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Analytics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">95%</div>
                      <div className="text-green-100 text-sm">Attendance Rate</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">168h</div>
                      <div className="text-blue-100 text-sm">Hours This Month</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">A+</div>
                      <div className="text-purple-100 text-sm">Performance</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Attendance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.from({ length: 5 }, (_, i) => {
                        const date = new Date();
                        date.setDate(date.getDate() - i);
                        return (
                          <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                            <div className="flex items-center space-x-3">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span className="text-sm font-medium">
                                {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold">8.5h</div>
                              <Badge variant="success" className="text-xs">Present</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Leave Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="text-sm font-medium">Vacation Days</span>
                        <span className="text-blue-600 font-bold">12 left</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium">Sick Leave</span>
                        <span className="text-green-600 font-bold">8 left</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <span className="text-sm font-medium">Personal Days</span>
                        <span className="text-orange-600 font-bold">3 left</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
                <Button variant="outline" className="text-green-600 border-green-600 hover:bg-green-50">
                  <Award className="h-4 w-4 mr-2" />
                  Give Recognition
                </Button>
                <Button variant="outline" className="text-orange-600 border-orange-600 hover:bg-orange-50">
                  <Target className="h-4 w-4 mr-2" />
                  Set Goals
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsTeamMemberDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
};

export default ManagerDashboard;