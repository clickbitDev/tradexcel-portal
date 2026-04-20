/**
 * Format a date string to DD-MM-YY format
 */
export function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);

    return `${day}-${month}-${year}`;
}

/**
 * Format a date string to DD-MM-YYYY format (full year)
 */
export function formatDateFull(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
}

/**
 * Format a datetime string to DD-MM-YY HH:MM format
 */
export function formatDateTime(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day}-${month}-${year} ${hours}:${minutes}`;
}

export function formatTime(timeString: string | null | undefined): string {
    if (!timeString) return '-';

    if (/^\d{2}:\d{2}/.test(timeString)) {
        return timeString.slice(0, 5);
    }

    const date = new Date(timeString);
    if (isNaN(date.getTime())) return '-';

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

export function formatAppointmentDateTime(
    appointmentDate: string | null | undefined,
    appointmentTime: string | null | undefined
): string {
    if (!appointmentDate) return '-';
    if (!appointmentTime) return formatDate(appointmentDate);

    const normalizedTime = formatTime(appointmentTime);
    if (normalizedTime === '-') return formatDate(appointmentDate);

    const combined = new Date(`${appointmentDate}T${normalizedTime}`);
    if (isNaN(combined.getTime())) {
        return `${formatDate(appointmentDate)} ${normalizedTime}`;
    }

    return formatDateTime(combined.toISOString());
}

export function formatDateInput(value: string | null | undefined): string {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
}

export function formatTimeInput(value: string | null | undefined): string {
    if (!value) return '';
    if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';

    const hours = parsed.getHours().toString().padStart(2, '0');
    const minutes = parsed.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}
