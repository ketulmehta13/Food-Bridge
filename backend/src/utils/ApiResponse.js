// Consistent success payload: { success, statusCode, message, data }.
export class ApiResponse {
  constructor(statusCode, data = null, message = 'Success') {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }

  // Shortcut for res.status(code).json(new ApiResponse(...)).
  static send(res, statusCode, data = null, message = 'Success') {
    return res.status(statusCode).json(new ApiResponse(statusCode, data, message));
  }
}
