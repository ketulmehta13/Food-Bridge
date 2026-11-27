import api from '../../../api/axiosInstance.js';

// All NGO API calls. Owner: Ketul. Paths are relative to /api.
// Each function returns the "data" part of the backend response.

/** GET /api/ngo/profile -> { user } */
export const getNgoProfile = async () => (await api.get('/ngo/profile')).data.data;

/**
 * PATCH /api/ngo/profile -> { user, verificationReset } plus the server message.
 * Send only changed fields; null clears an optional field.
 */
export const updateNgoProfile = async (body) => {
  const res = await api.patch('/ngo/profile', body);
  return { ...res.data.data, message: res.data.message };
};
