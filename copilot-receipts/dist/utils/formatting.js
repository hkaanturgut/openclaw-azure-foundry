import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
export function formatPercent(value) {
    return `${value.toFixed(1)}%`;
}
export function formatNumber(num) {
    return num.toLocaleString("en-US");
}
export function formatDate(dateStr, timezone) {
    const date = new Date(`${dateStr}T12:00:00Z`);
    if (timezone) {
        try {
            return formatInTimeZone(date, timezone, "yyyy-MM-dd (EEEE)");
        }
        catch {
            // fall through
        }
    }
    return format(date, "yyyy-MM-dd (EEEE)");
}
export function formatDateTime(date, timezone) {
    if (timezone) {
        try {
            return formatInTimeZone(date, timezone, "yyyy-MM-dd HH:mm:ss zzz");
        }
        catch {
            // fall through
        }
    }
    return format(date, "yyyy-MM-dd HH:mm:ss");
}
export function formatDuration(start, end) {
    const durationMs = end.getTime() - start.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0)
        return `${hours}h ${minutes % 60}m`;
    if (minutes > 0)
        return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}
//# sourceMappingURL=formatting.js.map