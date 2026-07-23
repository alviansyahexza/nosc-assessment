import { useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, parseISO } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { enUS } from 'date-fns/locale/en-US';
import type { ScheduleBlock } from '../api/types';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './CalendarView.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

interface CalendarViewProps {
  date: Date;
  schedule: ScheduleBlock[];
  timezone?: string;
}

export function CalendarView({ date, schedule, timezone = 'Europe/Berlin' }: CalendarViewProps) {
  const events = useMemo(() => {
    return schedule.map((block, idx) => ({
      id: idx,
      title: `Appointment (${block.status || 'Booked'})`,
      start: toZonedTime(parseISO(block.startsAt), timezone),
      end: toZonedTime(parseISO(block.endsAt), timezone),
      resource: block,
    }));
  }, [schedule, timezone]);

  const minTime = useMemo(() => new Date(0, 0, 0, 0, 0, 0), []);
  const maxTime = useMemo(() => new Date(0, 0, 0, 23, 59, 59), []);
  const scrollToTime = useMemo(() => new Date(0, 0, 0, 7, 0, 0), []);

  return (
    <div className="calendar-view">
      <h2 className="calendar-title">{formatInTimeZone(date, timezone, 'EEEE, MMMM d, yyyy')}</h2>
      <div className="rbc-container">
        <Calendar
          localizer={localizer}
          events={events}
          defaultView={Views.DAY}
          views={[Views.DAY, Views.WEEK]}
          date={date}
          toolbar={false}
          min={minTime}
          max={maxTime}
          scrollToTime={scrollToTime}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}
