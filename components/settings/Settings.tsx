'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { 
  Settings as SettingsIcon, 
  Building2, 
  FileText, 
  Calendar, 
  Upload, 
  Download, 
  Plus, 
  Edit, 
  Trash2,
  Clock,
  Shield,
  Bell,
  Mail,
  Globe,
  Database,
  Key,
  Users,
  Briefcase,
  CheckCircle
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [policies, setPolicies] = useState<CompanyPolicy[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('company');
  
  // Policy form state
  const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false);
  const [policyFormData, setPolicyFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    file: null as File | null
  });

  // Holiday form state
  const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false);
  const [holidayFormData, setHolidayFormData] = useState({
    name: '',
    date: '',
    type: 'public' as 'public' | 'company' | 'optional',
    description: ''
  });

  // Company settings
  const [companySettings, setCompanySettings] = useState({
    companyName: 'Span Communications',
    address: '6d3, Gundecha Onclave, Khairani Road Sakinaka, Andheri East, Mumbai 400072',
    phone: '+912226822360',
    email: 'info@spancom.in',
    website: 'www.spancom.in ',
    workingHours: '10:00 AM - 6:30 PM',
    timezone: 'UTC-5 (EST)',
    fiscalYearStart: 'January',
    currency: 'INR'
  });

  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editCompanyData, setEditCompanyData] = useState(companySettings);

  // Load policies and holidays from Firebase
  useEffect(() => {
    loadPolicies();
    loadHolidays();
  }, []);

  const loadPolicies = async () => {
    try {
      const q = query(collection(db, 'companyPolicies'), orderBy('uploadedAt', 'desc'));
      const snapshot = await getDocs(q);
      const policiesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploadedAt: doc.data().uploadedAt?.toDate() || new Date()
      })) as CompanyPolicy[];
      setPolicies(policiesList);
    } catch (error) {
      console.error('Error loading policies:', error);
      setPolicies([]);
    }
  };

  const loadHolidays = async () => {
    try {
      const q = query(collection(db, 'companyHolidays'), orderBy('date', 'asc'));
      const snapshot = await getDocs(q);
      const holidaysList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      })) as Holiday[];
      setHolidays(holidaysList);
    } catch (error) {
      console.error('Error loading holidays:', error);
      setHolidays([]);
    }
    setLoading(false);
  };

  const handleCompanySettingsUpdate = async () => {
    try {
      // In a real app, you'd save to Firebase or your backend
      setCompanySettings(editCompanyData);
      setIsEditingCompany(false);
      toast.success('Company settings updated successfully!');
    } catch (error) {
      console.error('Error updating company settings:', error);
      toast.error('Failed to update company settings');
    }
  };

  const handlePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!policyFormData.title.trim() || !policyFormData.description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const policyData = {
        title: policyFormData.title.trim(),
        description: policyFormData.description.trim(),
        category: policyFormData.category,
        fileUrl: `${policyFormData.title.replace(/\s+/g, '_')}.pdf`,
        uploadedAt: new Date(),
        uploadedBy: user?.name || 'Admin'
      };

      const docRef = await addDoc(collection(db, 'companyPolicies'), policyData);
      toast.success('Policy uploaded successfully!');
      setIsPolicyDialogOpen(false);
      setPolicyFormData({ title: '', description: '', category: 'general', file: null });
      loadPolicies(); // Reload policies to get updated list
    } catch (error) {
      console.error('Error uploading policy:', error);
      toast.error('Failed to upload policy');
    }
  };

  const handleHolidaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!holidayFormData.name.trim() || !holidayFormData.date) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const holidayData = {
        name: holidayFormData.name.trim(),
        date: new Date(holidayFormData.date),
        type: holidayFormData.type,
        description: holidayFormData.description.trim()
      };

      const docRef = await addDoc(collection(db, 'companyHolidays'), holidayData);
      toast.success('Holiday added successfully!');
      setIsHolidayDialogOpen(false);
      setHolidayFormData({ name: '', date: '', type: 'public', description: '' });
      loadHolidays(); // Reload holidays to get updated list
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast.error('Failed to add holiday');
    }
  };

  const handleDeletePolicy = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'companyPolicies', id));
      toast.success('Policy deleted successfully!');
      loadPolicies(); // Reload policies to get updated list
    } catch (error) {
      console.error('Error deleting policy:', error);
      toast.error('Failed to delete policy');
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
        
        page.drawText('SPAN COMMUNICATIONS', {
          x: width / 2 - 80,
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
        'This policy document has been created to establish clear guidelines and procedures for all employees, contractors, and stakeholders associated with Span Communications. It is imperative that all personnel familiarize themselves with the contents of this document and ensure full compliance.',
        '',
        'The policy outlined herein is designed to maintain the highest standards of professional conduct, operational efficiency, and legal compliance across all organizational activities.'
      ];
      
      pageState = addSection('POLICY OVERVIEW', overviewContent, pageState);
      
      // Detailed Policy Content Section
      const detailedContent = [
        '1. SCOPE AND APPLICABILITY',
        'This policy applies to all employees, contractors, temporary workers, consultants, and any other individuals who perform work for or on behalf of Span Communications.',
        '',
        '2. POLICY STATEMENT',
        'Span Communications is committed to maintaining the highest standards of integrity, professionalism, and ethical conduct in all business operations. This policy serves as a comprehensive guide to ensure consistent application of organizational standards.',
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
        '• Human Resources Department: hr@spancommunications.com',
        '• Policy Compliance Officer: compliance@spancommunications.com',
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
        `© ${new Date().getFullYear()} Span Communications. All rights reserved.`,
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

  const handleDeleteHoliday = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'companyHolidays', id));
      toast.success('Holiday deleted successfully!');
      loadHolidays(); // Reload holidays to get updated list
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast.error('Failed to delete holiday');
    }
  };

  const getHolidayTypeColor = (type: string) => {
    switch (type) {
      case 'public': return 'bg-blue-100 text-blue-800';
      case 'company': return 'bg-orange-100 text-orange-800';
      case 'optional': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'hr': return 'bg-purple-100 text-purple-800';
      case 'operations': return 'bg-blue-100 text-blue-800';
      case 'security': return 'bg-red-100 text-red-800';
      case 'finance': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
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
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage company settings, policies, and holidays</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'company', label: 'Company Info', icon: Building2 },
            { id: 'policies', label: 'Company Policies', icon: FileText },
            { id: 'holidays', label: 'Holiday Calendar', icon: Calendar },
            { id: 'system', label: 'System Settings', icon: SettingsIcon }
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

      {/* Company Info Tab */}
      {activeTab === 'company' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Company Information</span>
              </CardTitle>
              <CardDescription>Basic company details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingCompany ? (
                <>
                  <div>
                    <Label>Company Name</Label>
                    <Input 
                      value={editCompanyData.companyName} 
                      onChange={(e) => setEditCompanyData({...editCompanyData, companyName: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Textarea 
                      value={editCompanyData.address} 
                      onChange={(e) => setEditCompanyData({...editCompanyData, address: e.target.value})}
                      rows={2} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Phone</Label>
                      <Input 
                        value={editCompanyData.phone} 
                        onChange={(e) => setEditCompanyData({...editCompanyData, phone: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input 
                        value={editCompanyData.email} 
                        onChange={(e) => setEditCompanyData({...editCompanyData, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Website</Label>
                    <Input 
                      value={editCompanyData.website} 
                      onChange={(e) => setEditCompanyData({...editCompanyData, website: e.target.value})}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={handleCompanySettingsUpdate} className="bg-green-600 hover:bg-green-700">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsEditingCompany(false);
                      setEditCompanyData(companySettings);
                    }}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label>Company Name</Label>
                    <Input value={companySettings.companyName} readOnly />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Textarea value={companySettings.address} readOnly rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Phone</Label>
                      <Input value={companySettings.phone} readOnly />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={companySettings.email} readOnly />
                    </div>
                  </div>
                  <div>
                    <Label>Website</Label>
                    <Input value={companySettings.website} readOnly />
                  </div>
                  <Button onClick={() => setIsEditingCompany(true)} className="w-full bg-orange-600 hover:bg-orange-700">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Company Info
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Working Hours</span>
              </CardTitle>
              <CardDescription>Office schedule and working days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="font-semibold text-gray-900">Monday - Friday</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600 mb-1">10:00 AM - 6:30 PM</div>
                  <div className="text-sm text-blue-700">IST (Indian Standard Time)</div>
                </div>
                
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="font-semibold text-gray-900">Saturday</span>
                  </div>
                  <div className="text-lg font-bold text-orange-600 mb-1">Flexible Working</div>
                  <div className="text-sm text-orange-700">Work from home or office as needed</div>
                </div>
                
                <div className="bg-gradient-to-r from-red-50 to-pink-50 p-4 rounded-lg border border-red-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="font-semibold text-gray-900">Sunday</span>
                  </div>
                  <div className="text-lg font-bold text-red-600 mb-1">Off Day</div>
                  <div className="text-sm text-red-700">Complete rest day - No work expected</div>
                </div>
                
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">
                    <strong>Note:</strong> Lunch break is from 1:00 PM - 2:00 PM. 
                    Tea breaks are flexible throughout the day.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Company Policies Tab */}
      {activeTab === 'policies' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Company Policies</h2>
              <p className="text-gray-600">Manage and share company policy documents</p>
            </div>
            <Dialog open={isPolicyDialogOpen} onOpenChange={setIsPolicyDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-orange-600 hover:bg-orange-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Policy
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Company Policy</DialogTitle>
                  <DialogDescription>
                    Add a new policy document for employees to access
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handlePolicySubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="policy-title">Policy Title *</Label>
                    <Input
                      id="policy-title"
                      value={policyFormData.title}
                      onChange={(e) => setPolicyFormData({...policyFormData, title: e.target.value})}
                      placeholder="Enter policy title..."
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="policy-description">Description *</Label>
                    <Textarea
                      id="policy-description"
                      value={policyFormData.description}
                      onChange={(e) => setPolicyFormData({...policyFormData, description: e.target.value})}
                      placeholder="Describe the policy..."
                      rows={3}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="policy-category">Category</Label>
                    <select
                      id="policy-category"
                      value={policyFormData.category}
                      onChange={(e) => setPolicyFormData({...policyFormData, category: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="general">General</option>
                      <option value="hr">Human Resources</option>
                      <option value="operations">Operations</option>
                      <option value="security">Security</option>
                      <option value="finance">Finance</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="policy-file">Policy Document</Label>
                    <Input
                      id="policy-file"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setPolicyFormData({...policyFormData, file: e.target.files?.[0] || null})}
                      className="cursor-pointer"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsPolicyDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                      Upload Policy
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {policies.map((policy) => (
              <Card key={policy.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <FileText className="h-5 w-5 text-orange-600" />
                        <h3 className="text-lg font-semibold text-gray-900">{policy.title}</h3>
                        <Badge className={getCategoryColor(policy.category)}>
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
                          onClick={() => handleDownloadPolicy(policy)}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download PDF
                        </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeletePolicy(policy.id)}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Holiday Calendar Tab */}
      {activeTab === 'holidays' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Holiday Calendar</h2>
              <p className="text-gray-600">Manage company holidays and observances</p>
            </div>
            <Dialog open={isHolidayDialogOpen} onOpenChange={setIsHolidayDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-orange-600 hover:bg-orange-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Holiday
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Holiday</DialogTitle>
                  <DialogDescription>
                    Add a new holiday to the company calendar
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleHolidaySubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="holiday-name">Holiday Name *</Label>
                    <Input
                      id="holiday-name"
                      value={holidayFormData.name}
                      onChange={(e) => setHolidayFormData({...holidayFormData, name: e.target.value})}
                      placeholder="Enter holiday name..."
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="holiday-date">Date *</Label>
                      <Input
                        id="holiday-date"
                        type="date"
                        value={holidayFormData.date}
                        onChange={(e) => setHolidayFormData({...holidayFormData, date: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="holiday-type">Type</Label>
                      <select
                        id="holiday-type"
                        value={holidayFormData.type}
                        onChange={(e) => setHolidayFormData({...holidayFormData, type: e.target.value as 'public' | 'company' | 'optional'})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="public">Public Holiday</option>
                        <option value="company">Company Holiday</option>
                        <option value="optional">Optional Holiday</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="holiday-description">Description</Label>
                    <Textarea
                      id="holiday-description"
                      value={holidayFormData.description}
                      onChange={(e) => setHolidayFormData({...holidayFormData, description: e.target.value})}
                      placeholder="Holiday description..."
                      rows={2}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsHolidayDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                      Add Holiday
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

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
                          <Badge className={getHolidayTypeColor(holiday.type)}>
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteHoliday(holiday.id)}
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* System Settings Tab */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notification Settings</span>
              </CardTitle>
              <CardDescription>Configure system notifications and alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-gray-600">Send email alerts</p>
                </div>
                <input type="checkbox" className="toggle" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Leave Request Alerts</p>
                  <p className="text-sm text-gray-600">Notify managers of new requests</p>
                </div>
                <input type="checkbox" className="toggle" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Attendance Reminders</p>
                  <p className="text-sm text-gray-600">Daily clock-in reminders</p>
                </div>
                <input type="checkbox" className="toggle" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Settings;