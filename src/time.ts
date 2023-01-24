const addMonths = (months: number): Date => {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date;
};
const addDays = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};
const addHours = (hours: number): Date => {
  const date = new Date();
  date.setHours(date.getMonth() + hours);
  return date;
};
const addMinutes = (minutes: number): Date => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
};

export { addMonths, addDays, addHours, addMinutes };
