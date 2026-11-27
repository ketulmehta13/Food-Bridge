// Helpers for turning backend error responses into something a form can show.
// Backend format: { success: false, message, errors: [{ location, field, message }] }

// A single human-readable message for any failed request.
export const getErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (!err?.response) return 'Cannot reach the server. Is the backend running?';
  return err.response.data?.message || fallback;
};

// Field-level errors as { "ngoProfile.orgName": "Required", ... } for highlighting inputs.
export const getFieldErrors = (err) => {
  const list = err?.response?.data?.errors;
  if (!Array.isArray(list)) return {};
  return list.reduce((acc, e) => {
    if (e.field && !acc[e.field]) acc[e.field] = e.message;
    return acc;
  }, {});
};
