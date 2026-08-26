// Simple config, not hardcoded deep in logic — easy to revisit later.
export const SLOT_MINUTES = 30;
export const BUSINESS_HOURS = { startHour: 9, endHour: 17 }; // 9:00 AM - 5:00 PM
export const OPEN_WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri, JS Date#getDay() numbering
export const BOOKING_WINDOW_DAYS = 7;
