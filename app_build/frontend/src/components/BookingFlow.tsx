import { useState, useEffect } from 'react';
import { format, addDays, startOfDay, formatISO } from 'date-fns';
import { fetchApi } from '../api/client';
import type { Service, Doctor, Patient, Slot } from '../api/types';
import './BookingFlow.css';

interface BookingFlowProps {
  onDoctorSelect: (doctorId: number | null, date: Date) => void;
  onBookingComplete: () => void;
}

export function BookingFlow({ onDoctorSelect, onBookingComplete }: BookingFlowProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  
  const [selectedService, setSelectedService] = useState<number | ''>('');
  const [selectedDoctor, setSelectedDoctor] = useState<number | ''>('');
  const [selectedPatient, setSelectedPatient] = useState<number | ''>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApi('/services').then(data => setServices(data.services)).catch(console.error);
    fetchApi('/doctors').then(data => setDoctors(data.doctors)).catch(console.error);
    fetchApi('/patients').then(data => {
      setPatients(data.patients || []);
      if (data.patients && data.patients.length > 0) {
        setSelectedPatient(data.patients[0].id);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      onDoctorSelect(Number(selectedDoctor), new Date(selectedDate));
    } else {
      onDoctorSelect(null, new Date(selectedDate));
    }
  }, [selectedDoctor, selectedDate, onDoctorSelect]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedDate) return;
    
    setLoading(true);
    setError(null);
    setAvailableSlots([]);

    const fromDate = startOfDay(new Date(selectedDate));
    const toDate = addDays(fromDate, 1);

    try {
      const params = new URLSearchParams({
        serviceId: String(selectedService),
        from: formatISO(fromDate),
        to: formatISO(toDate),
      });

      if (selectedDoctor) {
        params.append('doctorIds', String(selectedDoctor));
      }

      const data = await fetchApi(`/availability?${params.toString()}`);
      setAvailableSlots(data.slots || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch availability');
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async (slot: Slot) => {
    try {
      setError(null);
      await fetchApi('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: Number(selectedPatient),
          serviceId: Number(selectedService),
          doctorId: slot.doctorId,
          roomId: slot.roomId,
          startsAt: slot.start,
        }),
      });
      alert('Booking successful!');
      setAvailableSlots([]); // Clear slots after booking
      onBookingComplete();
    } catch (err: any) {
      if (err.status === 409) {
        setError('Slot is no longer available. Please choose another time.');
        handleSearch(new Event('submit') as any); // Refresh slots
      } else {
        setError(err.message || 'Failed to create booking');
      }
    }
  };

  return (
    <div className="booking-flow">
      <h2 className="booking-title">New Booking</h2>
      
      <form onSubmit={handleSearch} className="booking-form">
        <div className="form-group">
          <label>Patient *</label>
          <select 
            value={selectedPatient} 
            onChange={e => setSelectedPatient(e.target.value ? Number(e.target.value) : '')}
            required
          >
            <option value="">Select a patient...</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name} {p.email ? `(${p.email})` : ''}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Service *</label>
          <select 
            value={selectedService} 
            onChange={e => setSelectedService(e.target.value ? Number(e.target.value) : '')}
            required
          >
            <option value="">Select a service...</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.durationMin}m)</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Doctor (Optional)</label>
          <select 
            value={selectedDoctor} 
            onChange={e => setSelectedDoctor(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Any available doctor...</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Date *</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={e => setSelectedDate(e.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={loading || !selectedService || !selectedDate} className="btn-primary">
          {loading ? 'Searching...' : 'Search Availability'}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}

      {availableSlots.length > 0 && (
        <div className="slots-container">
          <h3>Available Slots</h3>
          <div className="slots-list">
            {availableSlots.map((slot, idx) => {
              const start = new Date(slot.start);
              const end = new Date(slot.end);
              const doctor = doctors.find(d => d.id === slot.doctorId);
              
              return (
                <div key={idx} className="slot-card">
                  <div className="slot-info">
                    <span className="slot-time">{format(start, 'HH:mm')} - {format(end, 'HH:mm')}</span>
                    <span className="slot-doc">{doctor ? doctor.name : `Doctor #${slot.doctorId}`}</span>
                  </div>
                  <button onClick={() => handleBook(slot)} className="btn-book">Book Now</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {!loading && availableSlots.length === 0 && selectedService && !error && (
         <div className="empty-state">No slots available. Try another day or doctor.</div>
      )}
    </div>
  );
}
