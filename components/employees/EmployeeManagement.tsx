'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Search, 
  Filter,
  UserCheck,
  UserX,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
  Crown,
  Shield,
  User,
  Eye,
  Download,
  Upload
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, where, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db, createSecondaryApp } from '@/lib/firebase';
import { User as UserType } from '@/lib/types';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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

const EmployeeManagement: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<UserType | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<UserType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'manager' | 'employee'>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Predefined departments
  const predefinedDepartments = [
    'Tech',
    'Media', 
    'Creative',
    'Social Media',
    'Client Services',
    'Business Development',
    'Consultant'
  ];

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee' as 'admin' | 'manager' | 'employee',
    department: '',
    managerId: '',
    phone: '',
    emergencyContact: '',
    dateOfBirth: '',
    joinDate: '',
    address: '',
    profileImage: '',
    isActive: true
  });

  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      console.log('Loading employees...');
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      console.log('Found', snapshot.docs.length, 'employee documents');
      
      const employeeList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as UserType[];
      
      console.log('Processed employees:', employeeList.map(emp => ({ id: emp.id, name: emp.name, email: emp.email })));
      setEmployees(employeeList);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'employee',
      department: '',
      managerId: '',
      phone: '',
      emergencyContact: '',
      dateOfBirth: '',
      joinDate: '',
      address: '',
      profileImage: '',
      isActive: true
    });
    setProfileImageFile(null);
  };

  const uploadProfileImage = async (file: File): Promise<string> => {
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const storage = getStorage();
    const storageRef = ref(storage, `profile-images/${Date.now()}_${file.name}`);
    
    try {
      console.log('Uploading image:', file.name);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Image uploaded successfully:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim() || (!editingEmployee && !formData.password.trim())) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.department.trim()) {
      toast.error('Please select a department');
      return;
    }
    try {
      setUploading(true);
      
      let profileImageUrl = formData.profileImage;
      
      // Upload profile image if a new file is selected
      if (profileImageFile) {
        try {
          profileImageUrl = await uploadProfileImage(profileImageFile);
        } catch (error) {
          console.error('Error uploading image:', error);
          toast.error('Failed to upload profile image');
          setUploading(false);
          return;
        }
      }

      const employeeData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        department: formData.department.trim(),
        managerId: formData.managerId === 'none' || !formData.managerId ? '' : formData.managerId,
        phone: formData.phone.trim(),
        emergencyContact: formData.emergencyContact.trim(),
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : null,
        joinDate: formData.joinDate ? new Date(formData.joinDate) : new Date(),
        address: formData.address.trim(),
        profileImage: profileImageUrl,
        isActive: true,
        createdAt: editingEmployee ? editingEmployee.createdAt : new Date(),
        password: formData.password.trim()
      };

      console.log('Creating employee with data:', employeeData);
      if (editingEmployee) {
        // Update existing employee
        await updateDoc(doc(db, 'users', editingEmployee.id), employeeData);
        toast.success('Employee updated successfully!');
        setIsEditDialogOpen(false);
        setEditingEmployee(null);
      } else {
        // Create new employee
        try {
          // Create a secondary Firebase app instance to avoid affecting current admin session
          const secondaryApp = createSecondaryApp();
          
          // First, create Firebase Authentication user using secondary app
          console.log('Creating Firebase Auth user for:', formData.email.trim());
          const userCredential = await createUserWithEmailAndPassword(
            secondaryApp.auth, 
            formData.email.trim(), 
            formData.password.trim()
          );
          const firebaseUser = userCredential.user;
          
          console.log('Firebase Auth user created with UID:', firebaseUser.uid);
          
          // Remove password from employee data (never store in Firestore)
          const { password, ...employeeDataWithoutPassword } = employeeData;
          
          // Create Firestore document using Firebase Auth UID as document ID
          console.log('Creating Firestore document for user:', firebaseUser.uid);
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            ...employeeDataWithoutPassword,
            id: firebaseUser.uid
          });
          
          console.log('Employee created successfully:');
          console.log('- Firebase UID:', firebaseUser.uid);
          console.log('- Email:', firebaseUser.email);
          console.log('- Firestore document created');
          
          // Sign out from secondary app only (doesn't affect main admin session)
          await secondaryApp.auth.signOut();
          
          // Delete the secondary app to clean up resources
          await secondaryApp.delete();
          
          console.log('Employee creation completed successfully');
          
        } catch (firestoreError) {
          console.error('Employee creation error:', firestoreError);
          if (firestoreError && typeof firestoreError === 'object' && 'code' in firestoreError) {
            const error = firestoreError as { code: string; message: string };
            if (error.code === 'auth/email-already-in-use') {
              throw new Error('Email address is already registered');
            } else if (error.code === 'auth/weak-password') {
              throw new Error('Password should be at least 6 characters');
            } else if (error.code === 'auth/invalid-email') {
              throw new Error('Invalid email address');
            }
            throw new Error(`Failed to create employee: ${error.message}`);
          }
          throw new Error(`Failed to create employee: ${firestoreError instanceof Error ? firestoreError.message : 'Unknown error'}`);
        }
        
        // Success - close dialog and refresh
        toast.success('Employee created successfully! They can now log in with their credentials.');
        setIsCreateDialogOpen(false);
        resetForm();
        await loadEmployees(); // Ensure employees reload
        return; // Exit early on success
      }

      // Handle employee update (existing employee)
      if (editingEmployee) {
        await updateDoc(doc(db, 'users', editingEmployee.id), {
          ...employeeData,
          id: editingEmployee.id
        });
        
        toast.success('Employee updated successfully!');
        setIsEditDialogOpen(false);
        setEditingEmployee(null);
        resetForm();
        await loadEmployees();
      }
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast.error(error.message || 'Failed to save employee. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      
      setProfileImageFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData({...formData, profileImage: e.target?.result as string});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = (employee: UserType) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      password: '',
      role: employee.role,
      department: employee.department,
      managerId: employee.managerId || 'none',
      phone: employee.phone || '',
      emergencyContact: employee.emergencyContact || '',
      dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split('T')[0] : '',
      joinDate: employee.joinDate ? new Date(employee.joinDate).toISOString().split('T')[0] : '',
      address: employee.address || '',
      profileImage: employee.profileImage || '',
      isActive: employee.isActive ?? true
    });
    setProfileImageFile(null);
    setIsEditDialogOpen(true);
  };

  const handleView = (employee: UserType) => {
    setViewingEmployee(employee);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      toast.success('Employee deleted successfully!');
      loadEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Failed to delete employee');
    }
  };

  const handleToggleStatus = async (employee: UserType) => {
    try {
      await updateDoc(doc(db, 'users', employee.id), {
        isActive: !employee.isActive
      });
      toast.success(`Employee ${!employee.isActive ? 'activated' : 'deactivated'} successfully!`);
      loadEmployees();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const exportEmployeeData = () => {
    const exportData = employees.map(emp => ({
      'Name': emp.name,
      'Email': emp.email,
      'Role': emp.role,
      'Department': emp.department,
      'Phone': emp.phone || 'N/A',
      'Address': emp.address || 'N/A',
      'Status': emp.isActive ? 'Active' : 'Inactive',
      'Join Date': emp.createdAt ? emp.createdAt.toLocaleDateString() : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
    XLSX.writeFile(workbook, `employees_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast.success('Employee data exported successfully!');
  };

  // Get unique departments and managers
  const departments = predefinedDepartments;
  const managers = employees.filter(emp => emp.role === 'manager' || emp.role === 'admin');

  // Filter employees
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || employee.role === filterRole;
    const matchesDepartment = filterDepartment === 'all' || employee.department === filterDepartment;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && employee.isActive) ||
                         (filterStatus === 'inactive' && !employee.isActive);
    
    return matchesSearch && matchesRole && matchesDepartment && matchesStatus;
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Crown;
      case 'manager': return Shield;
      default: return User;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  // Statistics
  const stats = {
    total: employees.length,
    active: employees.filter(emp => emp.isActive).length,
    inactive: employees.filter(emp => !emp.isActive).length,
    admins: employees.filter(emp => emp.role === 'admin').length,
    managers: employees.filter(emp => emp.role === 'manager').length,
    employees: employees.filter(emp => emp.role === 'employee').length
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
          <h1 className="text-3xl font-bold text-gray-900">Employee Management</h1>
          <p className="text-gray-600 mt-1">Manage your organization's workforce</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={exportEmployeeData} variant="outline" className="border-orange-600 text-orange-600 hover:bg-orange-50">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
                <DialogDescription>
                  Create a new employee account with role and department assignment
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Enter full name..."
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="Enter email address..."
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="Enter password..."
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="Enter phone number..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="joinDate">Join Date</Label>
                    <Input
                      id="joinDate"
                      type="date"
                      value={formData.joinDate}
                      onChange={(e) => setFormData({...formData, joinDate: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="emergencyContact">Emergency Contact</Label>
                  <Input
                    id="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                    placeholder="Enter emergency contact number..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={formData.role} onValueChange={(value: 'admin' | 'manager' | 'employee') => setFormData({...formData, role: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="department">Department *</Label>
                    <Select value={formData.department} onValueChange={(value) => setFormData({...formData, department: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department..." />
                      </SelectTrigger>
                      <SelectContent>
                        {predefinedDepartments.map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="profileImage">Profile Photo</Label>
                  <Input
                    id="profileImage"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="cursor-pointer"
                  />
                  {formData.profileImage && (
                    <div className="mt-2">
                      <img 
                        src={formData.profileImage} 
                        alt="Profile preview" 
                        className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                      />
                    </div>
                  )}
                </div>

                {formData.role === 'employee' && (
                  <div>
                    <Label htmlFor="managerId">Manager</Label>
                    <Select value={formData.managerId} onValueChange={(value) => setFormData({...formData, managerId: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select manager..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Manager</SelectItem>
                        {managers.map(manager => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.name} ({manager.department})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Enter address..."
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Employee'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <div>
                <p className="text-sm opacity-90">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5" />
              <div>
                <p className="text-sm opacity-90">Active</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserX className="h-5 w-5" />
              <div>
                <p className="text-sm opacity-90">Inactive</p>
                <p className="text-2xl font-bold">{stats.inactive}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Crown className="h-5 w-5" />
              <div>
                <p className="text-sm opacity-90">Admins</p>
                <p className="text-2xl font-bold">{stats.admins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <div>
                <p className="text-sm opacity-90">Managers</p>
                <p className="text-2xl font-bold">{stats.managers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-teal-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <div>
                <p className="text-sm opacity-90">Employees</p>
                <p className="text-2xl font-bold">{stats.employees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
              <Select value={filterRole} onValueChange={(value: 'all' | 'admin' | 'manager' | 'employee') => setFilterRole(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={(value: 'all' | 'active' | 'inactive') => setFilterStatus(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <div className="grid gap-4">
        {filteredEmployees.length > 0 ? (
          filteredEmployees.map((employee) => {
            const RoleIcon = getRoleIcon(employee.role);
            const manager = managers.find(m => m.id === employee.managerId);
            
            return (
              <Card key={employee.id} className={`${!employee.isActive ? 'opacity-60' : ''} hover:shadow-lg transition-shadow`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold text-white">
                          {employee.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{employee.name}</h3>
                          <Badge className={getRoleColor(employee.role)}>
                            <RoleIcon className="h-3 w-3 mr-1" />
                            {employee.role}
                          </Badge>
                          <Badge variant={employee.isActive ? "success" : "destructive"}>
                            {employee.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4" />
                            <span>{employee.email}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Building2 className="h-4 w-4" />
                            <span>{employee.department}</span>
                          </div>
                          {employee.phone && (
                            <div className="flex items-center space-x-2">
                              <Phone className="h-4 w-4" />
                              <span>{employee.phone}</span>
                            </div>
                          )}
                        </div>
                        
                        {manager && (
                          <div className="mt-2 text-sm text-gray-500">
                            Reports to: <span className="font-medium">{manager.name}</span>
                          </div>
                        )}

                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(employee)}
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(employee)}
                      >
                        {employee.isActive ? (
                          <>
                            <UserX className="h-4 w-4 mr-1" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-4 w-4 mr-1" />
                            Activate
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(employee)}
                        className="text-orange-600 border-orange-600 hover:bg-orange-50"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-red-600 border-red-600 hover:bg-red-50">
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the employee account and all associated data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(employee.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No employees found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {searchTerm || filterRole !== 'all' || filterDepartment !== 'all' || filterStatus !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Add your first employee'
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
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information and role assignments
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Enter full name..."
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email Address *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="Enter email address..."
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="Enter phone number..."
                />
              </div>
              <div>
                <Label htmlFor="edit-emergencyContact">Emergency Contact</Label>
                <Input
                  id="edit-emergencyContact"
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                  placeholder="Enter emergency contact..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-role">Role</Label>
                <Select value={formData.role} onValueChange={(value: 'admin' | 'manager' | 'employee') => setFormData({...formData, role: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-department">Department</Label>
                <Select value={formData.department} onValueChange={(value) => setFormData({...formData, department: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department..." />
                  </SelectTrigger>
                  <SelectContent>
                    {predefinedDepartments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-dateOfBirth">Date of Birth</Label>
                <Input
                  id="edit-dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit-joinDate">Join Date</Label>
                <Input
                  id="edit-joinDate"
                  type="date"
                  value={formData.joinDate}
                  onChange={(e) => setFormData({...formData, joinDate: e.target.value})}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-profileImage">Profile Photo</Label>
              <Input
                id="edit-profileImage"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="cursor-pointer"
              />
              {formData.profileImage && (
                <div className="mt-2">
                  <img 
                    src={formData.profileImage} 
                    alt="Profile preview" 
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {formData.role === 'employee' && (
                <div>
                  <Label htmlFor="edit-managerId">Manager</Label>
                  <Select value={formData.managerId} onValueChange={(value) => setFormData({...formData, managerId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Manager</SelectItem>
                      {managers.map(manager => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.name} ({manager.department})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="Enter address..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
              />
              <Label htmlFor="edit-isActive">Active Employee</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                Update Employee
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
            <DialogDescription>
              Complete information about {viewingEmployee?.name}
            </DialogDescription>
          </DialogHeader>
          {viewingEmployee && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {viewingEmployee.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{viewingEmployee.name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge className={getRoleColor(viewingEmployee.role)}>
                      {viewingEmployee.role}
                    </Badge>
                    <Badge variant={viewingEmployee.isActive ? "success" : "destructive"}>
                      {viewingEmployee.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Email Address</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{viewingEmployee.email}</span>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Department</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span>{viewingEmployee.department}</span>
                    </div>
                  </div>

                  {viewingEmployee.phone && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Phone Number</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{viewingEmployee.phone}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Join Date</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{viewingEmployee.createdAt ? viewingEmployee.createdAt.toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>

                  {viewingEmployee.managerId && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Manager</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>{managers.find(m => m.id === viewingEmployee.managerId)?.name || 'Unknown'}</span>
                      </div>
                    </div>
                  )}

                  {viewingEmployee.address && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Address</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span>{viewingEmployee.address}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeManagement;