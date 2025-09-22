import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/lib/types';

export interface BirthdayEmployee {
  id: string;
  name: string;
  department: string;
  role: 'admin' | 'manager' | 'employee';
  dateOfBirth: Date;
  date: string;
  daysUntil: number;
}

export const useBirthdaySystem = (currentUserId: string) => {
  const [allEmployees, setAllEmployees] = useState<User[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<BirthdayEmployee[]>([]);
  const [isBirthdayToday, setIsBirthdayToday] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [birthdayMessage, setBirthdayMessage] = useState('');

  useEffect(() => {
    loadEmployeesAndCalculateBirthdays();
  }, [currentUserId]);

  const loadEmployeesAndCalculateBirthdays = async () => {
    try {
      // Load all employees
      const employeesSnapshot = await getDocs(collection(db, 'users'));
      const employees = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dateOfBirth: doc.data().dateOfBirth?.toDate() || null,
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as User[];

      // Filter active employees with birthdays
      const activeEmployees = employees.filter(emp => 
        emp.isActive !== false && emp.dateOfBirth
      );

      setAllEmployees(activeEmployees);

      // Calculate upcoming birthdays
      const today = new Date();
      const currentYear = today.getFullYear();
      const todayStr = `${today.getMonth() + 1}-${today.getDate()}`;

      const birthdayEmployees = activeEmployees
        .map(emp => {
          if (!emp.dateOfBirth) return null;

          const birthDate = new Date(emp.dateOfBirth);
          const thisYearBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
          
          // If birthday has passed this year, calculate for next year
          if (thisYearBirthday < today) {
            thisYearBirthday.setFullYear(currentYear + 1);
          }

          const daysUntil = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const empBirthdayStr = `${birthDate.getMonth() + 1}-${birthDate.getDate()}`;

          return {
            id: emp.id,
            name: emp.name,
            department: emp.department,
            role: emp.role,
            dateOfBirth: emp.dateOfBirth,
            date: thisYearBirthday.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            }),
            daysUntil: daysUntil
          };
        })
        .filter((emp): emp is BirthdayEmployee => emp !== null)
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .slice(0, 30); // Show next 30 upcoming birthdays

      setUpcomingBirthdays(birthdayEmployees);

      // Check if current user has birthday today
      const currentUser = activeEmployees.find(emp => emp.id === currentUserId);
      if (currentUser && currentUser.dateOfBirth) {
        const userBirthDate = new Date(currentUser.dateOfBirth);
        const userBirthdayStr = `${userBirthDate.getMonth() + 1}-${userBirthDate.getDate()}`;
        
        if (userBirthdayStr === todayStr) {
          setIsBirthdayToday(true);
          setBirthdayMessage(`Hope your special day brings you happiness and joy! 🎂`);
        }
      }

    } catch (error) {
      console.error('Error loading birthday data:', error);
    }
  };

  const triggerBirthdayAnimation = () => {
    setShowConfetti(true);
    
    // Hide confetti after 5 seconds
    setTimeout(() => {
      setShowConfetti(false);
    }, 5000);
  };

  return {
    upcomingBirthdays,
    isBirthdayToday,
    showConfetti,
    birthdayMessage,
    triggerBirthdayAnimation
  };
};