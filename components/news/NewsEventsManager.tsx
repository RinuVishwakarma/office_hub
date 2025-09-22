'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Newspaper, 
  Users, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Filter,
  Search
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NewsEvent, User } from '@/lib/types';
import toast from 'react-hot-toast';

// Create a simple Badge component since it's not available
const Badge: React.FC<{ children: React.ReactNode; className?: string; variant?: string }> = ({ 
  children, 
  className = '', 
  variant = 'default' 
}) => {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  const variantClasses = variant === 'secondary' 
    ? 'bg-gray-100 text-gray-800' 
    : 'bg-orange-100 text-orange-800';
  
  return (
    <span className={`${baseClasses} ${variantClasses} ${className}`}>
      {children}
    </span>
  );
};

const NewsEventsManager: React.FC = () => {
  const { user } = useAuth();
  const [newsEvents, setNewsEvents] = useState<NewsEvent[]>([]);
  const [allEmployees, setAllEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NewsEvent | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'news' | 'event'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  // Predefined departments (same as Employee Management)
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
    title: '',
    content: '',
    type: 'news' as 'news' | 'event',
    priority: 'medium' as 'low' | 'medium' | 'high',
    eventDate: '',
    departments: [] as string[],
    isActive: true
  });

  useEffect(() => {
    loadNewsEvents();
    loadEmployees();
  }, []);

  const loadNewsEvents = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'newsEvents'), orderBy('publishedAt', 'desc'));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        publishedAt: doc.data().publishedAt?.toDate() || new Date(),
        eventDate: doc.data().eventDate?.toDate() || null
      })) as NewsEvent[];
      setNewsEvents(items);
    } catch (error) {
      console.error('Error loading news/events:', error);
      toast.error('Failed to load news and events');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const employees = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setAllEmployees(employees.filter(emp => emp.isActive === true));
    } catch (error) {
      console.error('Error loading employees:', error);
      // Set empty array on error to prevent crashes
      setAllEmployees([]);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      type: 'news',
      priority: 'medium',
      eventDate: '',
      departments: [],
      isActive: true
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const newsEventData = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        type: formData.type,
        priority: formData.priority,
        publishedBy: user?.id || '',
        publishedAt: new Date(),
        eventDate: formData.eventDate ? new Date(formData.eventDate) : null,
        isActive: formData.isActive,
        departments: formData.departments.length > 0 ? formData.departments : ['all']
      };

      if (editingItem) {
        await updateDoc(doc(db, 'newsEvents', editingItem.id), newsEventData);
        toast.success('Item updated successfully!');
        setIsEditDialogOpen(false);
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'newsEvents'), newsEventData);
        toast.success('Item created successfully!');
        setIsCreateDialogOpen(false);
      }

      resetForm();
      loadNewsEvents();
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error('Failed to save item');
    }
  };

  const handleEdit = (item: NewsEvent) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      content: item.content,
      type: item.type,
      priority: item.priority,
      eventDate: item.eventDate ? item.eventDate.toISOString().split('T')[0] : '',
      departments: item.departments,
      isActive: item.isActive
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'newsEvents', id));
      toast.success('Item deleted successfully!');
      loadNewsEvents();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleToggleStatus = async (item: NewsEvent) => {
    try {
      await updateDoc(doc(db, 'newsEvents', item.id), {
        isActive: !item.isActive
      });
      toast.success(`Item ${!item.isActive ? 'activated' : 'deactivated'} successfully!`);
      loadNewsEvents();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };


  // Filter news events
  const filteredNewsEvents = newsEvents.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesPriority = filterPriority === 'all' || item.priority === filterPriority;
    
    return matchesSearch && matchesType && matchesPriority;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-orange-100 text-orange-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'event' ? Calendar : Newspaper;
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
          <h1 className="text-3xl font-bold text-gray-900">News & Events</h1>
          <p className="text-gray-600 mt-1">
            {user?.role === 'employee' ? 'View company announcements and events' : 'Manage company announcements and events'}
          </p>
        </div>
        {user?.role !== 'employee' && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700" onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create News/Event</DialogTitle>
              <DialogDescription>
                Add a new announcement or event for your organization
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(value: 'news' | 'event') => setFormData({...formData, type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="news">News</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value: 'low' | 'medium' | 'high') => setFormData({...formData, priority: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Enter title..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="content">Content *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="Enter content..."
                  rows={4}
                  required
                />
              </div>

              {formData.type === 'event' && (
                <div>
                  <Label htmlFor="eventDate">Event Date</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) => setFormData({...formData, eventDate: e.target.value})}
                  />
                </div>
              )}

              <div>
                <Label>Target Departments</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.departments.includes('all')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({...formData, departments: ['all']});
                        } else {
                          setFormData({...formData, departments: []});
                        }
                      }}
                    />
                    <span className="text-sm">All Departments</span>
                  </label>
                  {predefinedDepartments.map(dept => (
                    <label key={dept} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.departments.includes(dept) && !formData.departments.includes('all')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData, 
                              departments: [...formData.departments.filter(d => d !== 'all'), dept]
                            });
                          } else {
                            setFormData({
                              ...formData, 
                              departments: formData.departments.filter(d => d !== dept)
                            });
                          }
                        }}
                        disabled={formData.departments.includes('all')}
                      />
                      <span className="text-sm">{dept}</span>
                    </label>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search news and events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={(value: 'all' | 'news' | 'event') => setFilterType(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="news">News</SelectItem>
                  <SelectItem value="event">Events</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={(value: 'all' | 'low' | 'medium' | 'high') => setFilterPriority(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* News Events List */}
      <div className="grid gap-4">
        {filteredNewsEvents.length > 0 ? (
          filteredNewsEvents.map((item) => {
            const TypeIcon = getTypeIcon(item.type);
            return (
              <Card key={item.id} className={`${!item.isActive ? 'opacity-60' : ''}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <TypeIcon className="h-5 w-5 text-orange-600" />
                        <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                        <Badge className={getPriorityColor(item.priority)}>
                          {item.priority}
                        </Badge>
                        <Badge variant={item.isActive ? "default" : "secondary"}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      
                      <p className="text-gray-600 mb-3 line-clamp-2">{item.content}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>Published {item.publishedAt.toLocaleDateString()}</span>
                        </div>
                        {item.eventDate && (
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>Event: {item.eventDate.toLocaleDateString()}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>
                            {item.departments.includes('all') 
                              ? 'All Departments' 
                              : `${item.departments.length} Department${item.departments.length > 1 ? 's' : ''}`
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {user?.role !== 'employee' && (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(item)}
                          className={item.isActive ? 'text-orange-600 border-orange-600' : 'text-green-600 border-green-600'}
                        >
                          {item.isActive ? (
                            <>
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Activate
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 border-red-600">
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the {item.type}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(item.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Newspaper className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No news or events found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {searchTerm || filterType !== 'all' || filterPriority !== 'all' 
                    ? 'Try adjusting your filters' 
                    : 'Create your first announcement'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog - Only for non-employees */}
      {user?.role !== 'employee' && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {editingItem?.type === 'event' ? 'Event' : 'News'}</DialogTitle>
            <DialogDescription>
              Update the {editingItem?.type === 'event' ? 'event' : 'news'} information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-type">Type</Label>
                <Select value={formData.type} onValueChange={(value: 'news' | 'event') => setFormData({...formData, type: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="news">News</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value: 'low' | 'medium' | 'high') => setFormData({...formData, priority: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Enter title..."
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-content">Content *</Label>
              <Textarea
                id="edit-content"
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                placeholder="Enter content..."
                rows={4}
                required
              />
            </div>

            {formData.type === 'event' && (
              <div>
                <Label htmlFor="edit-eventDate">Event Date</Label>
                <Input
                  id="edit-eventDate"
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) => setFormData({...formData, eventDate: e.target.value})}
                />
              </div>
            )}

            <div>
              <Label>Target Departments</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.departments.includes('all')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({...formData, departments: ['all']});
                      } else {
                        setFormData({...formData, departments: []});
                      }
                    }}
                  />
                  <span className="text-sm">All Departments</span>
                </label>
                {predefinedDepartments.map(dept => (
                  <label key={dept} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.departments.includes(dept) && !formData.departments.includes('all')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData, 
                            departments: [...formData.departments.filter(d => d !== 'all'), dept]
                          });
                        } else {
                          setFormData({
                            ...formData, 
                            departments: formData.departments.filter(d => d !== dept)
                          });
                        }
                      }}
                      disabled={formData.departments.includes('all')}
                    />
                    <span className="text-sm">{dept}</span>
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                Update
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
};

export default NewsEventsManager;