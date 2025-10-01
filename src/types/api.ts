/**
 * Generic API request body for widget data
 */
export interface WidgetDataRequest {
  [key: string]: any;
}

/**
 * Generic API response for widget data
 */
export interface WidgetDataResponse<T = any> {
  data?: T;
  error?: string;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: string;
  status?: number;
}
