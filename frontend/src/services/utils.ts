export function formatTime(seconds: number) {
    if (isNaN(seconds)) return '00:00.0';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const decimalSeconds = Math.floor(seconds * 10 % 10);

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${decimalSeconds}`;
}

export function parseTime(time: string) {
    const [minutes, seconds] = time.split(':');
    return parseInt(minutes) * 60 + parseFloat(seconds);
}