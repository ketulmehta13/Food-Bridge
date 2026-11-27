import { useState } from 'react';
import Input from '../ui/Input.jsx';
import Button from '../ui/Button.jsx';

/**
 * Latitude/longitude inputs with a "Use my current location" button.
 * value: { lat: string, lng: string }   onChange: ({ lat, lng }) => void
 */
export default function LocationField({
  value,
  onChange,
  error,
  label = 'Location',
  hint = 'Used to show you food donations nearby.',
  required = false,
}) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  // Ask the browser for the current position (the user must allow it).
  const useMyLocation = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Your browser does not support location. Please enter it manually.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onChange({ lat: coords.latitude.toFixed(6), lng: coords.longitude.toFixed(6) });
        setLocating(false);
      },
      () => {
        setGeoError('Could not get your location. Please allow access or enter it manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const message = error || geoError;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
        <Button variant="secondary" onClick={useMyLocation} loading={locating} className="px-3 py-1 text-xs">
          Use my current location
        </Button>
      </div>
      {hint && <p className="mb-2 text-xs text-gray-500">{hint}</p>}
      <div className="grid grid-cols-2 gap-4">
        <Input
          placeholder="Latitude"
          aria-label="Latitude"
          inputMode="decimal"
          value={value.lat}
          onChange={(e) => onChange({ ...value, lat: e.target.value })}
        />
        <Input
          placeholder="Longitude"
          aria-label="Longitude"
          inputMode="decimal"
          value={value.lng}
          onChange={(e) => onChange({ ...value, lng: e.target.value })}
        />
      </div>
      {message && <p className="mt-1 text-xs text-red-600">{message}</p>}
    </div>
  );
}
