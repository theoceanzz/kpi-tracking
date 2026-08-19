export const ENV = {
  // Đường dẫn tương đối là mặc định bắt buộc: cookie phiên HttpOnly chỉ đi kèm request cùng origin.
  API_BASE_URL: (import.meta.env.VITE_API_BASE_URL as string) ?? '/api/v1',
  APP_NAME: import.meta.env.VITE_APP_NAME as string,
} as const
