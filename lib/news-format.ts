export function formatNewsDate(date: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Manila",
  }).format(new Date(date));
}
