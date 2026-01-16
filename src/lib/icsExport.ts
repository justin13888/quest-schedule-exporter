import { generateIcsCalendar, type IcsCalendar, type IcsEvent } from "ts-ics";
import type { Course, ParsedSchedule } from "./schema";

/**
 * Parse day abbreviations to day names for ICS
 */
function parseDays(daysStr: string): string[] {
    const dayMap: Record<string, string> = {
        M: "MO",
        T: "TU",
        W: "WE",
        Th: "TH",
        F: "FR",
        S: "SA",
        Su: "SU",
    };

    const days: string[] = [];

    // Handle patterns like "TTh", "MWF", etc.
    let i = 0;
    while (i < daysStr.length) {
        // Check for two-char patterns first (Th, Su)
        if (i + 1 < daysStr.length) {
            const twoChar = daysStr.slice(i, i + 2);
            if (dayMap[twoChar]) {
                days.push(dayMap[twoChar]);
                i += 2;
                continue;
            }
        }
        // Single char
        const oneChar = daysStr[i];
        if (dayMap[oneChar]) {
            days.push(dayMap[oneChar]);
        }
        i++;
    }

    return days;
}

/**
 * Parse time string like "4:00PM - 5:20PM" to start/end Date objects
 */
function parseTimeRange(
    timeStr: string,
    baseDate: Date,
): { start: Date; end: Date } | null {
    if (timeStr === "TBA" || !timeStr.includes("-")) return null;

    const [startStr, endStr] = timeStr.split(" - ").map((s) => s.trim());

    const parseTime = (str: string, date: Date): Date => {
        const match = str.match(/^(\d{1,2}):(\d{2})(AM|PM)$/i);
        if (!match) return date;

        let hours = Number.parseInt(match[1], 10);
        const minutes = Number.parseInt(match[2], 10);
        const isPM = match[3].toUpperCase() === "PM";

        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;

        const result = new Date(date);
        result.setHours(hours, minutes, 0, 0);
        return result;
    };

    return {
        start: parseTime(startStr, baseDate),
        end: parseTime(endStr, baseDate),
    };
}

/**
 * Parse date range like "05/01/2026 - 06/04/2026"
 */
function parseDateRange(dateStr: string): { start: Date; end: Date } | null {
    const parts = dateStr.split(" - ").map((s) => s.trim());
    if (parts.length !== 2) return null;

    const parseDate = (str: string): Date | null => {
        const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match) return null;
        return new Date(
            Number.parseInt(match[3], 10),
            Number.parseInt(match[1], 10) - 1,
            Number.parseInt(match[2], 10),
        );
    };

    const start = parseDate(parts[0]);
    const end = parseDate(parts[1]);
    if (!start || !end) return null;

    return { start, end };
}

/**
 * Apply template placeholders
 */
function applyTemplate(
    template: string,
    course: Course,
    session: Course["sessions"][0],
): string {
    return template
        .replace(/@code/g, course.courseCode)
        .replace(/@section/g, session.section)
        .replace(/@name/g, course.courseName)
        .replace(/@type/g, session.component)
        .replace(/@location/g, session.room)
        .replace(/@prof/g, session.instructor);
}

/**
 * Generate ICS calendar from parsed schedule
 */
export function generateScheduleIcs(
    schedule: ParsedSchedule,
    summaryTemplate: string,
    descriptionTemplate: string,
): { icsContent: string; warnings: string[] } {
    const events: IcsEvent[] = [];
    const warnings: string[] = [];

    for (const course of schedule.courses) {
        for (const session of course.sessions) {
            // Skip TBA sessions
            if (session.daysAndTimes === "TBA") {
                warnings.push(
                    `Skipped ${course.courseCode} (${session.component}): Time is TBA`,
                );
                continue;
            }

            const dateRange = parseDateRange(session.startEndDates);
            if (!dateRange) {
                warnings.push(
                    `Skipped ${course.courseCode} (${session.component}): Invalid date range "${session.startEndDates}"`,
                );
                continue;
            }

            // Extract days and time from "TTh 4:00PM - 5:20PM"
            const dayTimeMatch =
                session.daysAndTimes.match(/^([A-Za-z]+)\s+(.+)$/);
            if (!dayTimeMatch) {
                warnings.push(
                    `Skipped ${course.courseCode} (${session.component}): Could not parse days and times "${session.daysAndTimes}"`,
                );
                continue;
            }

            const daysStr = dayTimeMatch[1];
            const timeStr = dayTimeMatch[2];

            const days = parseDays(daysStr);
            if (days.length === 0) {
                warnings.push(
                    `Skipped ${course.courseCode} (${session.component}): No valid days found in "${daysStr}"`,
                );
                continue;
            }

            const timeRange = parseTimeRange(timeStr, dateRange.start);
            if (!timeRange) {
                warnings.push(
                    `Skipped ${course.courseCode} (${session.component}): Could not parse time range "${timeStr}"`,
                );
                continue;
            }

            // Find the first occurrence (first day in the range that matches)
            const firstDay = dateRange.start;
            const dayOfWeek = firstDay.getDay();
            const dayIndexMap: Record<string, number> = {
                SU: 0,
                MO: 1,
                TU: 2,
                WE: 3,
                TH: 4,
                FR: 5,
                SA: 6,
            };

            // Find the first matching day
            const eventStart = new Date(timeRange.start);
            let minDaysAhead = 7;
            for (const day of days) {
                const targetDay = dayIndexMap[day];
                const daysAhead = (targetDay - dayOfWeek + 7) % 7;
                if (daysAhead < minDaysAhead) {
                    minDaysAhead = daysAhead;
                }
            }
            eventStart.setDate(eventStart.getDate() + minDaysAhead);

            const eventEnd = new Date(eventStart);
            eventEnd.setHours(
                timeRange.end.getHours(),
                timeRange.end.getMinutes(),
            );

            const event: IcsEvent = {
                uid: `${course.courseCode}-${session.classNumber}@quest-exporter`,
                stamp: { date: new Date() },
                start: {
                    date: eventStart,
                },
                end: {
                    date: eventEnd,
                },
                summary: applyTemplate(summaryTemplate, course, session),
                description: applyTemplate(
                    descriptionTemplate,
                    course,
                    session,
                ),
                location: session.room,
                recurrenceRule: {
                    frequency: "WEEKLY",
                    until: { date: dateRange.end },
                    byDay: days.map((d) => ({
                        day: d as
                            | "MO"
                            | "TU"
                            | "WE"
                            | "TH"
                            | "FR"
                            | "SA"
                            | "SU",
                    })),
                },
            };

            events.push(event);
        }
    }

    const calendar: IcsCalendar = {
        prodId: "-//Quest Schedule Exporter//EN",
        version: "2.0",
        events,
    };

    return { icsContent: generateIcsCalendar(calendar), warnings };
}

/**
 * Trigger browser download of ICS file
 */
export function downloadIcs(
    icsContent: string,
    filename: string,
): void {
    const blob = new Blob([icsContent], {
        type: "text/calendar",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}
