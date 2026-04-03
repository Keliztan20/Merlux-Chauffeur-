const RAPID_API_KEY = import.meta.env.VITE_FLIGHT_API_KEY || '';
const RAPID_API_HOST = 'aerodatabox.p.rapidapi.com';

export interface FlightStatus {
  flightNumber: string;
  status: string;
  scheduledArrival: string;
  estimatedArrival?: string;
  actualArrival?: string;
  delayMinutes?: number;
  terminal?: string;
  gate?: string;
}

export async function fetchFlightStatus(flightNumber: string, date: string): Promise<FlightStatus | null> {
  if (!RAPID_API_KEY) {
    console.warn('Flight API key is missing. Please set VITE_FLIGHT_API_KEY in your environment.');
    return null;
  }

  try {
    // AeroDataBox expects flight number and date (YYYY-MM-DD)
    const response = await fetch(
      `https://${RAPID_API_HOST}/flights/number/${flightNumber}/${date}?withStatus=true`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPID_API_KEY,
          'x-rapidapi-host': RAPID_API_HOST,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Flight API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // AeroDataBox returns an array of flights (could be multiple legs)
    if (!data || !Array.isArray(data) || data.length === 0) return null;

    // We take the last leg for arrival info
    const flight = data[data.length - 1];
    const arrival = flight.arrival;

    return {
      flightNumber: flight.number,
      status: flight.status || 'Unknown',
      scheduledArrival: arrival?.scheduledTimeLocal || '',
      estimatedArrival: arrival?.estimatedTimeLocal,
      actualArrival: arrival?.actualTimeLocal,
      delayMinutes: flight.arrival?.delayMinutes || 0,
      terminal: arrival?.terminal,
      gate: arrival?.gate,
    };
  } catch (error) {
    console.error('Error fetching flight status:', error);
    return null;
  }
}
