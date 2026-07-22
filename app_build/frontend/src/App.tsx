import { useState, useCallback, useEffect } from 'react';
import { addDays, startOfDay, formatISO } from 'date-fns';
import { BookingFlow } from './components/BookingFlow';
import { CalendarView } from './components/CalendarView';
import { fetchApi } from './api/client';
import type { ScheduleBlock } from './api/types';
import './App.css';

function App() {
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);

  const loadSchedule = useCallback(async (doctorId: number | null, date: Date) => {
    if (!doctorId) {
      setSchedule([]);
      return;
    }

    try {
      const from = startOfDay(date);
      const to = addDays(from, 1);
      const data = await fetchApi(`/doctors/${doctorId}/schedule?from=${formatISO(from)}&to=${formatISO(to)}`);
      setSchedule(data.schedule || []);
    } catch (error) {
      console.error('Failed to load schedule:', error);
      setSchedule([]);
    }
  }, []);

  useEffect(() => {
    loadSchedule(selectedDoctorId, selectedDate);
  }, [selectedDoctorId, selectedDate, loadSchedule]);

  const handleDoctorSelect = useCallback((doctorId: number | null, date: Date) => {
    setSelectedDoctorId(doctorId);
    setSelectedDate(date);
  }, []);

  const handleBookingComplete = useCallback(() => {
    // Refresh the calendar view
    loadSchedule(selectedDoctorId, selectedDate);
  }, [loadSchedule, selectedDoctorId, selectedDate]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1>NoscAi Clinic</h1>
          <div className="tenant-badge">Tenant ID: 42</div>
        </div>
      </header>

      <main className="main-content">
        <div className="left-panel">
          <BookingFlow
            onDoctorSelect={handleDoctorSelect}
            onBookingComplete={handleBookingComplete}
          />
        </div>

        <div className="right-panel">
          {selectedDoctorId ? (
            <CalendarView date={selectedDate} schedule={schedule} />
          ) : (
            <div className="empty-calendar">
              <p>Select a doctor in the booking wizard to view their schedule for the selected day.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
