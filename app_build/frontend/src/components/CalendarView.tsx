import { format, parseISO, differenceInMinutes, startOfDay, set } from 'date-fns';
import type { ScheduleBlock } from '../api/types';
import './CalendarView.css';

interface CalendarViewProps {
  date: Date;
  schedule: ScheduleBlock[];
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 08:00 to 18:00

export function CalendarView({ date, schedule }: CalendarViewProps) {
  const dayStart = startOfDay(date);
  const startHour = 8;
  const totalMinutes = 10 * 60; // 8 AM to 6 PM

  return (
    <div className="calendar-view">
      <h2 className="calendar-title">{format(date, 'EEEE, MMMM d, yyyy')}</h2>
      
      <div className="calendar-grid">
        <div className="time-column">
          {HOURS.map(hour => (
            <div key={hour} className="time-slot">
              {hour}:00
            </div>
          ))}
        </div>
        
        <div className="events-column">
          {HOURS.map(hour => (
            <div key={hour} className="grid-line" />
          ))}

          {schedule.map((block, idx) => {
            const start = parseISO(block.startsAt);
            const end = parseISO(block.endsAt);
            
            const baseTime = set(dayStart, { hours: startHour, minutes: 0, seconds: 0, milliseconds: 0 });
            const startOffset = differenceInMinutes(start, baseTime);
            const duration = differenceInMinutes(end, start);
            
            if (startOffset < 0 || startOffset >= totalMinutes) return null;

            const top = `${(startOffset / totalMinutes) * 100}%`;
            const height = `${(duration / totalMinutes) * 100}%`;

            return (
              <div 
                key={idx} 
                className="event-block"
                style={{ top, height }}
              >
                <div className="event-time">
                  {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                </div>
                <div className="event-status">{block.status}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
