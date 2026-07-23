import { IAvailabilityRepository, AvailabilityResourceData } from '../repositories/interfaces/IAvailabilityRepository';
import { toDate, addMinutes } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

interface Interval {
  start: Date;
  end: Date;
}

interface Slot {
  doctorId: number;
  roomId: number;
  deviceIds: number[];
  start: string;
  end: string;
}

const EVENT_PRIORITY: Record<'b_start' | 'w_start' | 'w_end' | 'b_end', number> = {
  b_start: 1, // Kunci Blokir (Keamanan Utama)
  w_start: 2, // Buka Shift Kerja
  w_end: 3,   // Tutup Shift Kerja
  b_end: 4,   // Lepas Blokir
};

export function calculateFreeIntervals(workingIntervals: Interval[], blockedIntervals: Interval[]): Interval[] {
  const events: { time: number; type: 'w_start' | 'w_end' | 'b_start' | 'b_end' }[] = [];

  for (const w of workingIntervals) {
    events.push({ time: w.start.getTime(), type: 'w_start' });
    events.push({ time: w.end.getTime(), type: 'w_end' });
  }
  for (const b of blockedIntervals) {
    events.push({ time: b.start.getTime(), type: 'b_start' });
    events.push({ time: b.end.getTime(), type: 'b_end' });
  }

  // Strict deterministic tie-breaking order
  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return EVENT_PRIORITY[a.type] - EVENT_PRIORITY[b.type];
  });

  let workingCount = 0;
  let blockCount = 0;

  let isFree = false;
  let freeStart: number | null = null;

  const freeIntervals: Interval[] = [];

  for (const ev of events) {
    if (ev.type === 'w_start') workingCount++;
    if (ev.type === 'w_end') workingCount--;
    if (ev.type === 'b_start') blockCount++;
    if (ev.type === 'b_end') blockCount--;

    const currentlyFree = workingCount > 0 && blockCount === 0;

    if (currentlyFree && !isFree) {
      // Transition to FREE
      isFree = true;
      freeStart = ev.time;
    } else if (!currentlyFree && isFree) {
      // Transition to NOT FREE
      isFree = false;
      if (freeStart !== null && ev.time > freeStart) {
        freeIntervals.push({ start: new Date(freeStart), end: new Date(ev.time) });
      }
      freeStart = null;
    }
  }

  return freeIntervals;
}

/**
 * Two-pointer intersection of two lists of disjoint, sorted intervals
 */
export function intersectIntervalLists(listA: Interval[], listB: Interval[]): Interval[] {
  const result: Interval[] = [];
  let i = 0;
  let j = 0;

  while (i < listA.length && j < listB.length) {
    const a = listA[i];
    const b = listB[j];

    // Find overlap
    const start = new Date(Math.max(a.start.getTime(), b.start.getTime()));
    const end = new Date(Math.min(a.end.getTime(), b.end.getTime()));

    if (start < end) {
      result.push({ start, end });
    }

    // Advance the pointer that ends first
    if (a.end < b.end) {
      i++;
    } else {
      j++;
    }
  }

  return result;
}


export class AvailabilityService {
  constructor(private readonly availabilityRepo: IAvailabilityRepository) { }

  async getAvailability(
    tenantId: number,
    serviceId: number,
    fromDateStr: string,
    toDateStr: string,
    doctorIds?: number[]
  ) {
    const fromDate = new Date(fromDateStr);
    const toDate = new Date(toDateStr);

    const data = await this.availabilityRepo.getAvailabilityData(tenantId, serviceId, fromDate, toDate, doctorIds);

    // Total required time
    const totalDuration = data.durationMin + data.bufferBeforeMin + data.bufferAfterMin;

    // Timezone - assuming Europe/Berlin based on README
    const TIMEZONE = 'Europe/Berlin';

    // 1. Generate working hour intervals in UTC for the requested date range
    const doctorWorkingHours: Record<number, Interval[]> = {};
    for (const docId of data.validDoctorIds) {
      doctorWorkingHours[docId] = [];
    }

    // A simple loop over days in the range to instantiate working hours
    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      const weekday = d.getDay(); // 0 = Sunday, 1 = Monday
      const dateString = formatInTimeZone(d, TIMEZONE, 'yyyy-MM-dd');

      for (const wh of data.workingHours) {
        // Adjusting weekday (JS getDay() has Sun=0. Assuming our DB has Mon=1, Sun=7 or Sun=0. Let's assume JS standard: 0-6)
        if (wh.weekday === weekday) {
          const startUtc = fromZonedTime(`${dateString} ${wh.startTime}`, TIMEZONE);
          const endUtc = fromZonedTime(`${dateString} ${wh.endTime}`, TIMEZONE);

          if (!doctorWorkingHours[wh.doctorId]) doctorWorkingHours[wh.doctorId] = [];
          doctorWorkingHours[wh.doctorId].push({ start: startUtc, end: endUtc });
        }
      }
    }

    // 2. Build block intervals for Doctors, Rooms, Devices
    const doctorBlocks: Record<number, Interval[]> = {};
    const roomBlocks: Record<number, Interval[]> = {};
    const deviceBlocks: Record<number, Interval[]> = {};

    data.validDoctorIds.forEach(id => doctorBlocks[id] = []);
    data.allRoomIds.forEach(id => roomBlocks[id] = []);
    data.requiredDeviceIds.forEach(id => deviceBlocks[id] = []);

    // Apply Breaks
    for (const b of data.breaks) {
      if (b.resourceType === 'doctor' && doctorBlocks[b.resourceId]) doctorBlocks[b.resourceId].push({ start: b.startsAt, end: b.endsAt });
      if (b.resourceType === 'room' && roomBlocks[b.resourceId]) roomBlocks[b.resourceId].push({ start: b.startsAt, end: b.endsAt });
      if (b.resourceType === 'device' && deviceBlocks[b.resourceId]) deviceBlocks[b.resourceId].push({ start: b.startsAt, end: b.endsAt });
    }

    // Apply Appointments
    for (const a of data.appointments) {
      if (doctorBlocks[a.doctorId]) doctorBlocks[a.doctorId].push({ start: a.startsAt, end: a.endsAt });
      if (roomBlocks[a.roomId]) roomBlocks[a.roomId].push({ start: a.startsAt, end: a.endsAt });
    }
    for (const ad of data.appointmentDevices) {
      if (deviceBlocks[ad.deviceId]) deviceBlocks[ad.deviceId].push({ start: ad.startsAt, end: ad.endsAt });
    }

    // 3. Sweep Line Algorithm to find Free Intervals
    const doctorFree: Record<number, Interval[]> = {};
    for (const docId of data.validDoctorIds) {
      doctorFree[docId] = calculateFreeIntervals(doctorWorkingHours[docId] || [], doctorBlocks[docId] || []);
    }

    // For rooms and devices, base interval is just fromDate to toDate
    const baseRoomDeviceInterval = [{ start: fromDate, end: toDate }];

    const roomFree: Record<number, Interval[]> = {};
    for (const roomId of data.allRoomIds) {
      roomFree[roomId] = calculateFreeIntervals(baseRoomDeviceInterval, roomBlocks[roomId] || []);
    }

    const deviceFree: Record<number, Interval[]> = {};
    for (const devId of data.requiredDeviceIds) {
      deviceFree[devId] = calculateFreeIntervals(baseRoomDeviceInterval, deviceBlocks[devId] || []);
    }

    // 4. Intersect & Chunk Slots
    const allSlots: Slot[] = [];

    for (const docId of data.validDoctorIds) {
      for (const roomId of data.allRoomIds) {
        // Intersect Doc and Room
        let intersection = intersectIntervalLists(doctorFree[docId], roomFree[roomId]);

        // Intersect all required Devices
        for (const devId of data.requiredDeviceIds) {
          intersection = intersectIntervalLists(intersection, deviceFree[devId]);
        }

        // Chunk the resulting free blocks into bookable slots (Sequential packing)
        for (const block of intersection) {
          let currentStart = block.start;
          while (true) {
            const currentEnd = addMinutes(currentStart, totalDuration);
            if (currentEnd > block.end) {
              break; // Doesn't fit in this block
            }

            // Note: We return the start/end of the *Core Service* by adding bufferBefore
            const coreStart = addMinutes(currentStart, data.bufferBeforeMin);
            const coreEnd = addMinutes(coreStart, data.durationMin);

            allSlots.push({
              doctorId: docId,
              roomId: roomId,
              deviceIds: data.requiredDeviceIds,
              start: coreStart.toISOString(),
              end: coreEnd.toISOString()
            });

            // Step forward by the total duration (Sequential Packing)
            // Or we could step by 15 mins for more overlap. Let's step by totalDuration.
            currentStart = currentEnd;
          }
        }
      }
    }

    // 5. Sort by time and limit to top 3 slots
    allSlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    // Only return the next 3 available slots as per README requirement
    return {
      slots: allSlots.slice(0, 3),
      limit: 3
    };
  }
}