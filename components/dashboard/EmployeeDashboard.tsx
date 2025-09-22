'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkTimer } from '@/hooks/useWorkTimer';
import { useBirthdaySystem } from '@/hooks/useBirthdaySystem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Newspaper, 
  TrendingUp, 
  MapPin,
  Timer,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Target,
  Award,
  Zap,
  Activity,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  Gift,
  Cake,
  PartyPopper,
  FileText,
  Download,
  Eye
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AttendanceRecord, LeaveRequest, NewsEvent, User } from '@/lib/types';
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

const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const { timer, displayTime, isActive, isPaused, startTimer, stopTimer, startBreak, endBreak } = useWorkTimer(user?.id || '');
  const { 
    isBirthdayToday, 
    upcomingBirthdays, 
    showConfetti, 
    birthdayMessage,
    triggerBirthdayAnimation 
  } = useBirthdaySystem(user?.id || '');
  
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [leaveBalance, setLeaveBalance] = useState({ 
    sick: 10, 
    vacation: 15, 
    personal: 5, 
    maternity: 90, 
    emergency: 3 
  });
  const [recentNews, setRecentNews] = useState<NewsEvent[]>([]);
  const [policies, setPolicies] = useState<CompanyPolicy[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [breakReason, setBreakReason] = useState('');
  const [isBreakDialogOpen, setIsBreakDialogOpen] = useState(false);
  const [workLocation, setWorkLocation] = useState('office');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [clockInLoading, setClockInLoading] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);

  // Work locations
  const workLocations = [
    { value: 'office', label: 'Office', icon: '🏢' },
    { value: 'home', label: 'Work from Home', icon: '🏠' },
    { value: 'client-site', label: 'Client Site', icon: '🏛️' },
    { value: 'co-working', label: 'Co-working Space', icon: '☕' },
    { value: 'other', label: 'Other Location', icon: '📍' }
  ];

  // Break reasons
  const breakReasons = [
    { value: 'lunch', label: 'Lunch Break', icon: '🍽️' },
    { value: 'coffee', label: 'Coffee Break', icon: '☕' },
    { value: 'personal', label: 'Personal Break', icon: '👤' },
    { value: 'meeting', label: 'Meeting', icon: '👥' },
    { value: 'restroom', label: 'Restroom', icon: '🚻' },
    { value: 'other', label: 'Other', icon: '⏸️' }
  ];

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
      loadPoliciesAndHolidays();
      
      // Trigger birthday animation if it's user's birthday
      if (isBirthdayToday) {
        setTimeout(() => {
          triggerBirthdayAnimation();
        }, 1000);
      }
    }
    
    // Listen for online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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

  const loadDashboardData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Load recent attendance records
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('userId', '==', user.id)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const records = attendanceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        clockIn: doc.data().clockIn?.toDate() || null,
        clockOut: doc.data().clockOut?.toDate() || null
      })) as AttendanceRecord[];
      
      // Sort by date descending and limit to 10
      const sortedRecords = records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
      setAttendanceRecords(sortedRecords);

      // Get today's attendance
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = records.find(record => record.date === today);
      setTodayAttendance(todayRecord || null);

      // Load recent news
      const newsQuery = query(
        collection(db, 'newsEvents'),
        where('isActive', '==', true)
      );
      const newsSnapshot = await getDocs(newsQuery);
      const news = newsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        publishedAt: doc.data().publishedAt?.toDate() || new Date(),
        eventDate: doc.data().eventDate?.toDate() || null
      })) as NewsEvent[];
      
      // Filter for user's department or all departments
      const filteredNews = news.filter(item => 
        item.departments.includes('all') || 
        item.departments.includes(user.department)
      ).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, 5);
      
      setRecentNews(filteredNews);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    if (!isOnline) {
      toast.error('You need to be online to clock in');
      return;
    }

    if (clockInLoading) return;

    try {
      setClockInLoading(true);
      await startTimer(workLocation);
      
      // Record clock in with location
      const today = new Date().toISOString().split('T')[0];
      const clockInTime = new Date();
      
      await addDoc(collection(db, 'attendance'), {
        userId: user?.id,
        date: today,
        clockIn: clockInTime,
        status: 'present',
        workLocation: workLocation,
        breaks: [],
        totalHours: 0
      });
      
      toast.success(`Clocked in at ${clockInTime.toLocaleTimeString()}!`);
      loadDashboardData();
    } catch (error) {
      console.error('Clock in error:', error);
      toast.error('Failed to clock in');
    } finally {
      setClockInLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      const totalTime = await stopTimer();
      const hours = Math.round((totalTime || 0) / (1000 * 60 * 60) * 100) / 100;
      const clockOutTime = new Date();
      
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
          clockOut: clockOutTime,
          totalHours: hours,
          breaks: timer?.breakRecords || []
        });
      }
      
      toast.success(`Clocked out at ${clockOutTime.toLocaleTimeString()}! Total: ${hours} hours`);
      loadDashboardData();
    } catch (error) {
      console.error('Clock out error:', error);
      toast.error('Failed to clock out');
    }
  };

  const handleStartBreak = async () => {
    try {
      await startBreak(breakReason || 'General break');
      toast.success(`${breakReason ? breakReasons.find(r => r.value === breakReason)?.label : 'Break'} started`);
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

  // Calculate statistics
  const thisWeekHours = attendanceRecords
    .filter(record => {
      const recordDate = new Date(record.date);
      const now = new Date();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      return recordDate >= weekStart;
    })
    .reduce((sum, record) => sum + record.totalHours, 0);

  const thisMonthHours = attendanceRecords
    .filter(record => {
      const recordDate = new Date(record.date);
      const now = new Date();
      return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, record) => sum + record.totalHours, 0);

  const attendanceRate = attendanceRecords.length > 0 
    ? Math.round((attendanceRecords.filter(r => r.status === 'present').length / attendanceRecords.length) * 100)
    : 0;

  const currentTime = new Date();
  const greeting = currentTime.getHours() < 12 ? 'Good Morning' : 
                  currentTime.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-600"></div>
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-2">
            <span>{greeting}, {user?.name?.split(' ')[0]}!</span>
            {currentTime.getHours() < 12 ? <Sun className="h-8 w-8 text-yellow-500" /> : <Moon className="h-8 w-8 text-blue-500" />}
          </h1>
          <p className="text-gray-600 mt-1">Track your time, manage tasks, and stay updated</p>
        </div>
        <div className="text-right">
          <div className="flex items-center space-x-2 mb-2">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 font-medium">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600 font-medium">Offline</span>
              </>
            )}
          </div>
          <p className="text-sm text-gray-500">Today's Date</p>
          <p className="font-semibold">{new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
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
      {/* Time Tracking Card */}
      <Card className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-700 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
        
        <CardHeader className="relative z-10">
          <CardTitle className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Timer className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xl">Work Timer</span>
              <div className="text-blue-100 text-sm font-normal">
                {isActive ? (isPaused ? 'On Break' : 'Working') : 'Ready to Start'}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-5xl font-bold mb-2 font-mono tracking-wider">
                {displayTime}
              </div>
              
              {/* Work Location Selector */}
              {!isActive && (
                <div className="mb-4">
                  <Label className="text-blue-100 text-sm mb-2 block">Work Location</Label>
                  <select
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                    className="bg-white/20 border border-white/30 text-white text-sm rounded-lg px-3 py-2 backdrop-blur-sm"
                  >
                    {workLocations.map(location => (
                      <option key={location.value} value={location.value} className="text-gray-900">
                        {location.icon} {location.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex space-x-3">
                {!isActive ? (
                  <Button 
                    onClick={handleClockIn} 
                    variant="secondary" 
                    size="lg"
                    disabled={!isOnline || clockInLoading}
                    className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-6"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    {clockInLoading ? 'Starting...' : 'Clock In'}
                  </Button>
                ) : (
                  <>
                    <Button 
                      onClick={handleClockOut} 
                      variant="secondary" 
                      size="lg"
                      className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-6"
                    >
                      <Square className="h-5 w-5 mr-2" />
                      Clock Out
                    </Button>
                    {!isPaused ? (
                      <Dialog open={isBreakDialogOpen} onOpenChange={setIsBreakDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="lg"
                            className="bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur-sm"
                          >
                            <Coffee className="h-5 w-5 mr-2" />
                            Take Break
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Take a Break</DialogTitle>
                            <DialogDescription>
                              What type of break are you taking?
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="breakReason">Break Type</Label>
                              <Select value={breakReason} onValueChange={setBreakReason}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select break type..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {breakReasons.map(reason => (
                                    <SelectItem key={reason.value} value={reason.value}>
                                      {reason.icon} {reason.label}
                                    </SelectItem>
                                  ))}
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
                      <Button 
                        onClick={handleEndBreak} 
                        variant="outline" 
                        size="lg"
                        className="bg-green-500/20 border-green-400/30 text-white hover:bg-green-500/30 backdrop-blur-sm"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        End Break
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            
            {/* Today's Stats */}
            <div className="text-right">
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-2xl font-bold">{thisWeekHours.toFixed(1)}h</div>
                <div className="text-blue-100 text-sm">This Week</div>
                {todayAttendance && (
                  <div className="mt-2 pt-2 border-t border-white/20">
                    <div className="text-sm">
                      <div>In: {todayAttendance.clockIn?.toLocaleTimeString() || 'N/A'}</div>
                      <div>Out: {todayAttendance.clockOut?.toLocaleTimeString() || 'N/A'}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Break Status */}
          {isPaused && (
            <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center space-x-3">
                <Coffee className="h-5 w-5 text-yellow-200" />
                <div>
                  <div className="font-medium">You're on a break</div>
                  <div className="text-sm text-yellow-200">
                    {breakReason ? breakReasons.find(r => r.value === breakReason)?.label : 'Break'} in progress
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Current Location Display */}
          {isActive && (
            <div className="flex items-center space-x-2 text-blue-100 text-sm">
              <MapPin className="h-4 w-4" />
              <span>Working from: {workLocations.find(loc => loc.value === workLocation)?.label}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{thisMonthHours.toFixed(1)}h</div>
                <div className="text-green-100 text-sm">This Month</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{leaveBalance.vacation}</div>
                <div className="text-blue-100 text-sm">Vacation Days</div>
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
                <div className="text-2xl font-bold">{attendanceRate}%</div>
                <div className="text-purple-100 text-sm">Attendance Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">A+</div>
                <div className="text-orange-100 text-sm">Performance</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & News */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-orange-600" />
              <span>Recent Attendance</span>
            </CardTitle>
            <CardDescription>Your attendance history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {attendanceRecords.slice(0, 7).map((record) => (
                <div key={record.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      record.status === 'present' ? 'bg-green-500' :
                      record.status === 'late' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <div className="font-medium text-sm">
                        {new Date(record.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                      <div className="text-xs text-gray-500">
                        {record.clockIn ? record.clockIn.toLocaleTimeString() : 'N/A'} - {record.clockOut ? record.clockOut.toLocaleTimeString() : 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm">{record.totalHours.toFixed(1)}h</div>
                    <Badge variant={
                      record.status === 'present' ? 'success' :
                      record.status === 'late' ? 'warning' : 'destructive'
                    }>
                      {record.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {attendanceRecords.length === 0 && (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">No attendance records yet</p>
                  <p className="text-gray-400 text-xs">Start tracking your time!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Newspaper className="h-5 w-5 text-orange-600" />
              <span>Latest News & Updates</span>
            </CardTitle>
            <CardDescription>Company announcements and events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentNews.map((news) => (
                <div key={news.id} className="border-l-4 border-orange-500 pl-4 py-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm text-gray-900 mb-1">{news.title}</h4>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">{news.content}</p>
                      <div className="flex items-center space-x-2">
                        <Badge className={
                          news.priority === 'high' ? 'bg-red-100 text-red-800' :
                          news.priority === 'medium' ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }>
                          {news.priority}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {news.publishedAt.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {recentNews.length === 0 && (
                <div className="text-center py-8">
                  <Newspaper className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">No recent announcements</p>
                  <p className="text-gray-400 text-xs">Stay tuned for updates!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Birthdays */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Cake className="h-5 w-5 text-pink-600" />
              <span>Upcoming Birthdays</span>
            </CardTitle>
            <CardDescription>Celebrate with your colleagues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingBirthdays.slice(0, 5).map((birthday) => (
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
                <div className="text-center py-8">
                  <Cake className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">No upcoming birthdays</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
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
    </div>
  );
};

export default EmployeeDashboard;