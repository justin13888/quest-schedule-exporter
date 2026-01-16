import { generateIcsCalendar, type IcsCalendar, type IcsEvent } from "ts-ics";
import { parseDaysAndTimes, type WeekDays } from "@/lib/parser";
import type { Course, ParsedSchedule } from "@/lib/schema";

/**
 * Convert WeekDays object to ICS day codes
 */
function getIcsDays(
    days: WeekDays,
): ("MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU")[] {
    const icsDays: ("MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU")[] = [];

    if (days.monday) icsDays.push("MO");
    if (days.tuesday) icsDays.push("TU");
    if (days.wednesday) icsDays.push("WE");
    if (days.thursday) icsDays.push("TH");
    if (days.friday) icsDays.push("FR");
    if (days.saturday) icsDays.push("SA");
    if (days.sunday) icsDays.push("SU");

    return icsDays;
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
            const dateRange = {
                start: session.startDate,
                end: session.endDate,
            };

            // Parse schedule pattern
            const pattern = parseDaysAndTimes(session.daysAndTimes);
            if (!pattern) {
                // If it's just TBA, we skip silently or warn? Existing logic was warn if TBA or fail to parse.
                if (session.daysAndTimes === "TBA") {
                    warnings.push(
                        `Skipped ${course.courseCode} (${session.component}): Time is TBA`,
                    );
                } else {
                    warnings.push(
                        `Skipped ${course.courseCode} (${session.component}): Could not parse days and times "${session.daysAndTimes}"`,
                    );
                }
                continue;
            }

            const days = getIcsDays(pattern.days);
            if (days.length === 0) {
                warnings.push(
                    `Skipped ${course.courseCode} (${session.component}): No valid days found in "${session.daysAndTimes}"`,
                );
                continue;
            }

            // Find the first occurrence (first day in the range that matches)
            const firstDay = dateRange.start;
            const dayOfWeek = firstDay.getDay(); // 0=Sun, 1=Mon...
            const dayIndexMap: Record<string, number> = {
                SU: 0,
                MO: 1,
                TU: 2,
                WE: 3,
                TH: 4,
                FR: 5,
                SA: 6,
            };

            let minDaysAhead = 7;
            for (const day of days) {
                const targetDay = dayIndexMap[day];
                const daysAhead = (targetDay - dayOfWeek + 7) % 7;
                if (daysAhead < minDaysAhead) {
                    minDaysAhead = daysAhead;
                }
            }

            const eventStart = new Date(dateRange.start);
            eventStart.setDate(eventStart.getDate() + minDaysAhead);
            eventStart.setHours(
                pattern.startTime.hour,
                pattern.startTime.minute,
                0,
                0,
            );

            const eventEnd = new Date(eventStart);
            eventEnd.setHours(
                pattern.endTime.hour,
                pattern.endTime.minute,
                0,
                0,
            );

            // If end time is before start time (e.g. crossing midnight), add 1 day
            if (eventEnd < eventStart) {
                eventEnd.setDate(eventEnd.getDate() + 1);
            }

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
export function downloadIcs(icsContent: string, filename: string): void {
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
