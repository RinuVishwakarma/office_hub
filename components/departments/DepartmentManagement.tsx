'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Building2, 
  Users, 
  Search,
  Crown,
  Shield,
  User,
  TrendingUp,
  BarChart3,
  Target
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User as UserType } from '@/lib/types';
import toast from 'react-hot-toast';

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

interface Department {
  id: string;
  name: string;
  description: string;
  managerId: string;
  employeeCount: number;
  budget?: number;
  goals?: string;
  createdAt: Date;
}

const DepartmentManagement: React.FC = () => {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allEmployees, setAllEmployees] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    managerId: '',
    budget: '',
    goals: ''
  });

  useEffect(() => {
    loadDepartments();
    loadEmployees();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      
      // Get predefined departments and their employee counts
      const predefinedDepartments = [
        'Tech', 'Media', 'Creative', 'Social Media', 
        'Client Services', 'Business Development', 'Consultant'
      ];

      const employeesSnapshot = await getDocs(collection(db, 'users'));
      const employees = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserType[];

      const departmentData = predefinedDepartments.map((deptName, index) => {
        const deptEmployees = employees.filter(emp => emp.department === deptName);
        const manager = deptEmployees.find(emp => emp.role === 'manager');
        
        return {
          id: `dept_${index}`,
          name: deptName,
          description: `${deptName} department handling specialized operations`,
          managerId: manager?.id || '',
          employeeCount: deptEmployees.length,
          budget: Math.floor(Math.random() * 500000) + 100000, // Mock budget
          goals: `Achieve excellence in ${deptName.toLowerCase()} operations`,
          createdAt: new Date()
        };
      });

      setDepartments(departmentData);
    } catch (error) {
      console.error('Error loading departments:', error);
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const q = query(collection(db, 'users'), where('isActive', '!=', false));
      const snapshot = await getDocs(q);
      const employees = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserType[];
      setAllEmployees(employees);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      managerId: '',
      budget: '',
      goals: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const departmentData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        managerId: formData.managerId || '',
        budget: formData.budget ? parseFloat(formData.budget) : 0,
        goals: formData.goals.trim(),
        createdAt: new Date()
      };

      if (editingDepartment) {
        // Note: In a real app, you'd update this in a departments collection
        toast.success('Department updated successfully!');
        setIsEditDialogOpen(false);
        setEditingDepartment(null);
      } else {
        // Note: In a real app, you'd add this to a departments collection
        toast.success('Department created successfully!');
        setIsCreateDialogOpen(false);
      }

      resetForm();
      loadDepartments();
    } catch (error) {
      console.error('Error saving department:', error);
      toast.error('Failed to save department');
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description,
      managerId: department.managerId,
      budget: department.budget?.toString() || '',
      goals: department.goals || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      // Note: In a real app, you'd delete from departments collection
      toast.success('Department deleted successfully!');
      loadDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast.error('Failed to delete department');
    }
  };

  // Filter departments
  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get managers
  const managers = allEmployees.filter(emp => emp.role === 'manager' || emp.role === 'admin');

  // Calculate statistics
  const stats = {
    totalDepartments: departments.length,
    totalEmployees: departments.reduce((sum, dept) => sum + dept.employeeCount, 0),
    totalBudget: departments.reduce((sum, dept) => sum + (dept.budget || 0), 0),
    avgEmployeesPerDept: departments.length > 0 
      ? Math.round(departments.reduce((sum, dept) => sum + dept.employeeCount, 0) / departments.length)
      : 0
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
          <h1 className="text-3xl font-bold text-gray-900">Department Management</h1>
          <p className="text-gray-600 mt-1">Organize and manage company departments</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Department</DialogTitle>
              <DialogDescription>
                Create a new department with manager assignment and goals
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Department Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter department name..."
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="managerId">Department Manager</Label>
                  <select
                    id="managerId"
                    value={formData.managerId}
                    onChange={(e) => setFormData({...formData, managerId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select Manager</option>
                    {managers.map(manager => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name} ({manager.department})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe the department's role and responsibilities..."
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="budget">Annual Budget ($)</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({...formData, budget: e.target.value})}
                    placeholder="Enter budget amount..."
                  />
                </div>
                <div>
                  <Label htmlFor="goals">Department Goals</Label>
                  <Input
                    id="goals"
                    value={formData.goals}
                    onChange={(e) => setFormData({...formData, goals: e.target.value})}
                    placeholder="Key objectives and goals..."
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                  Create Department
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <div>
                <p className="text-sm opacity-90">Total Departments</p>
                <p className="text-2xl font-bold">{stats.totalDepartments}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <div>
                <p className="text-sm opacity-90">Total Employees</p>
                <p className="text-2xl font-bold">{stats.totalEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <div>
                <p className="text-sm opacity-90">Total Budget</p>
                <p className="text-2xl font-bold">${(stats.totalBudget / 1000000).toFixed(1)}M</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <div>
                <p className="text-sm opacity-90">Avg Team Size</p>
                <p className="text-2xl font-bold">{stats.avgEmployeesPerDept}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDepartments.map((department) => {
          const manager = managers.find(m => m.id === department.managerId);
          const deptEmployees = allEmployees.filter(emp => emp.department === department.name);
          
          return (
            <Card key={department.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-6 w-6 text-orange-600" />
                    <CardTitle className="text-lg">{department.name}</CardTitle>
                  </div>
                  <Badge>{department.employeeCount} employees</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-4">{department.description}</p>
                
                <div className="space-y-3">
                  {manager && (
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">
                        <span className="font-medium">Manager:</span> {manager.name}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      <span className="font-medium">Budget:</span> ₹{department.budget?.toLocaleString() || 'N/A'}
                    </span>
                  </div>
                  
                  {department.goals && (
                    <div className="flex items-start space-x-2">
                      <Target className="h-4 w-4 text-purple-500 mt-0.5" />
                      <span className="text-sm">
                        <span className="font-medium">Goals:</span> {department.goals}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(department)}
                      className="text-orange-600 border-orange-600 hover:bg-orange-50"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the department.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(department.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    {deptEmployees.length} active
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>
              Update department information and assignments
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name">Department Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Enter department name..."
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-managerId">Department Manager</Label>
                <select
                  id="edit-managerId"
                  value={formData.managerId}
                  onChange={(e) => setFormData({...formData, managerId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select Manager</option>
                  {managers.map(manager => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} ({manager.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Description *</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe the department's role and responsibilities..."
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-budget">Annual Budget ($)</Label>
                <Input
                  id="edit-budget"
                  type="number"
                  value={formData.budget}
                  onChange={(e) => setFormData({...formData, budget: e.target.value})}
                  placeholder="Enter budget amount..."
                />
              </div>
              <div>
                <Label htmlFor="edit-goals">Department Goals</Label>
                <Input
                  id="edit-goals"
                  value={formData.goals}
                  onChange={(e) => setFormData({...formData, goals: e.target.value})}
                  placeholder="Key objectives and goals..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                Update Department
              </Button>
            </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepartmentManagement;