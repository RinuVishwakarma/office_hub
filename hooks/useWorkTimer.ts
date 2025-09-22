import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

export interface TimerData {
  id?: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  breakRecords: BreakRecord[];
  totalBreakTime: number;
  workLocation: string;
  status: 'active' | 'break' | 'completed';
  date: string;
}

export interface BreakRecord {
  startTime: Date;
  endTime?: Date;
  reason: string;
  duration?: number;
}

export const useWorkTimer = (userId: string) => {
  const [timer, setTimer] = useState<TimerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentBreakTime, setCurrentBreakTime] = useState(0);

  // Load existing timer on mount
  useEffect(() => {
    if (userId) {
      loadExistingTimer();
    }
  }, [userId]);


  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (timer && timer.status !== 'completed') {
      interval = setInterval(() => {
        const now = new Date();
        const startTime = timer.startTime instanceof Date ? timer.startTime : new Date(timer.startTime);
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        
        // Calculate current break time
        let totalBreakTime = timer.totalBreakTime;
        const activeBreak = timer.breakRecords.find(br => !br.endTime);
        if (activeBreak) {
          const breakStart = activeBreak.startTime instanceof Date ? activeBreak.startTime : new Date(activeBreak.startTime);
          const currentBreakDuration = Math.floor((now.getTime() - breakStart.getTime()) / 1000);
          setCurrentBreakTime(currentBreakDuration);
          totalBreakTime += currentBreakDuration;
        } else {
          setCurrentBreakTime(0);
        }
        
        setElapsedTime(elapsed - totalBreakTime);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer]);

  const loadExistingTimer = async () => {
    try {
      setIsLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      const q = query(
        collection(db, 'workTimers'),
        where('userId', '==', userId),
        where('date', '==', today)
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const docData = snapshot.docs[0];
        const data = docData.data();
        
        const timerData: TimerData = {
          id: docData.id,
          userId: data.userId,
          startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(data.startTime),
          endTime: data.endTime ? (data.endTime instanceof Timestamp ? data.endTime.toDate() : new Date(data.endTime)) : undefined,
          breakRecords: (data.breakRecords || []).map((br: any) => ({
            startTime: br.startTime instanceof Timestamp ? br.startTime.toDate() : new Date(br.startTime),
            endTime: br.endTime ? (br.endTime instanceof Timestamp ? br.endTime.toDate() : new Date(br.endTime)) : undefined,
            reason: br.reason,
            duration: br.duration
          })),
          totalBreakTime: data.totalBreakTime || 0,
          workLocation: data.workLocation || 'Office',
          status: data.status || 'active',
          date: data.date
        };
        
        setTimer(timerData);
      }
    } catch (error) {
      console.error('Error loading timer:', error);
      toast.error('Failed to load timer data');
    } finally {
      setIsLoading(false);
    }
  };

  const startTimer = async (workLocation: string = 'Office') => {
    if (!userId) {
      console.error('Cannot start timer: userId is missing');
      toast.error('User ID is required to start timer');
      return;
    }

    // Check if user is authenticated
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) {
      console.error('User not authenticated');
      toast.error('You must be logged in to start the timer');
      return;
    }

    try {
      console.log('Starting timer for user:', userId, 'at location:', workLocation);
      console.log('Current auth user:', auth.currentUser?.uid);
      
      // Check if there's already an active timer for today
      const today = new Date().toISOString().split('T')[0];
      const existingQuery = query(
        collection(db, 'workTimers'),
        where('userId', '==', userId),
        where('date', '==', today),
        where('status', 'in', ['active', 'break'])
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      if (!existingSnapshot.empty) {
        console.warn('Timer already active for today');
        toast.error('You already have an active timer for today');
        return;
      }

      const now = new Date();
      
      const timerData: Omit<TimerData, 'id'> = {
        userId,
        startTime: now,
        breakRecords: [],
        totalBreakTime: 0,
        workLocation,
        status: 'active',
        date: today
      };

      console.log('Creating timer document with data:', timerData);

      const docRef = await addDoc(collection(db, 'workTimers'), {
        ...timerData,
        startTime: Timestamp.fromDate(now)
      });

      console.log('Timer document created with ID:', docRef.id);

      setTimer({ ...timerData, id: docRef.id });
      toast.success('Timer started successfully!');
    } catch (error) {
      console.error('Error starting timer:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      toast.error(`Failed to start timer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const stopTimer = async () => {
    if (!timer?.id) return 0;

    try {
      const now = new Date();
      
      // End any active break
      let updatedBreakRecords = [...timer.breakRecords];
      let totalBreakTime = timer.totalBreakTime;
      
      const activeBreakIndex = updatedBreakRecords.findIndex(br => !br.endTime);
      if (activeBreakIndex !== -1) {
        const activeBreak = updatedBreakRecords[activeBreakIndex];
        const breakStart = activeBreak.startTime instanceof Date ? activeBreak.startTime : new Date(activeBreak.startTime);
        const breakDuration = Math.floor((now.getTime() - breakStart.getTime()) / 1000);
        
        updatedBreakRecords[activeBreakIndex] = {
          ...activeBreak,
          endTime: now,
          duration: breakDuration
        };
        totalBreakTime += breakDuration;
      }

      // Calculate total work time
      const startTime = timer.startTime instanceof Date ? timer.startTime : new Date(timer.startTime);
      const totalTime = now.getTime() - startTime.getTime();

      await updateDoc(doc(db, 'workTimers', timer.id), {
        endTime: Timestamp.fromDate(now),
        status: 'completed',
        breakRecords: updatedBreakRecords.map(br => ({
          ...br,
          startTime: Timestamp.fromDate(br.startTime instanceof Date ? br.startTime : new Date(br.startTime)),
          endTime: br.endTime ? Timestamp.fromDate(br.endTime instanceof Date ? br.endTime : new Date(br.endTime)) : null
        })),
        totalBreakTime
      });

      setTimer(prev => prev ? { ...prev, endTime: now, status: 'completed', breakRecords: updatedBreakRecords, totalBreakTime } : null);
      toast.success('Timer stopped successfully!');
      return totalTime;
    } catch (error) {
      console.error('Error stopping timer:', error);
      toast.error('Failed to stop timer');
      return 0;
    }
  };

  const startBreak = async (reason: string) => {
    if (!timer?.id) return;

    try {
      const now = new Date();
      const newBreakRecord: BreakRecord = {
        startTime: now,
        reason
      };

      const updatedBreakRecords = [...timer.breakRecords, newBreakRecord];

      await updateDoc(doc(db, 'workTimers', timer.id), {
        breakRecords: updatedBreakRecords.map(br => ({
          ...br,
          startTime: Timestamp.fromDate(br.startTime instanceof Date ? br.startTime : new Date(br.startTime)),
          endTime: br.endTime ? Timestamp.fromDate(br.endTime instanceof Date ? br.endTime : new Date(br.endTime)) : null
        })),
        status: 'break'
      });

      setTimer(prev => prev ? { ...prev, breakRecords: updatedBreakRecords, status: 'break' } : null);
      toast.success('Break started');
    } catch (error) {
      console.error('Error starting break:', error);
      toast.error('Failed to start break');
    }
  };

  const endBreak = async () => {
    if (!timer?.id) return;

    try {
      const now = new Date();
      const updatedBreakRecords = [...timer.breakRecords];
      const activeBreakIndex = updatedBreakRecords.findIndex(br => !br.endTime);
      
      if (activeBreakIndex !== -1) {
        const activeBreak = updatedBreakRecords[activeBreakIndex];
        const breakStart = activeBreak.startTime instanceof Date ? activeBreak.startTime : new Date(activeBreak.startTime);
        const breakDuration = Math.floor((now.getTime() - breakStart.getTime()) / 1000);
        
        updatedBreakRecords[activeBreakIndex] = {
          ...activeBreak,
          endTime: now,
          duration: breakDuration
        };

        const newTotalBreakTime = timer.totalBreakTime + breakDuration;

        await updateDoc(doc(db, 'workTimers', timer.id), {
          breakRecords: updatedBreakRecords.map(br => ({
            ...br,
            startTime: Timestamp.fromDate(br.startTime instanceof Date ? br.startTime : new Date(br.startTime)),
            endTime: br.endTime ? Timestamp.fromDate(br.endTime instanceof Date ? br.endTime : new Date(br.endTime)) : null
          })),
          totalBreakTime: newTotalBreakTime,
          status: 'active'
        });

        setTimer(prev => prev ? { 
          ...prev, 
          breakRecords: updatedBreakRecords, 
          totalBreakTime: newTotalBreakTime,
          status: 'active' 
        } : null);
        
        toast.success('Break ended');
      }
    } catch (error) {
      console.error('Error ending break:', error);
      toast.error('Failed to end break');
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isActive = timer && timer.status !== 'completed';
  const isPaused = timer?.status === 'break';
  const displayTime = formatTime(elapsedTime);

  return {
    timer,
    isLoading,
    elapsedTime,
    currentBreakTime,
    isActive: !!isActive,
    isPaused: !!isPaused,
    displayTime,
    startTimer,
    stopTimer,
    startBreak,
    endBreak,
    formatTime,
    loadExistingTimer
  };
};