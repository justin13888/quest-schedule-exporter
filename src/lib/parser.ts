import type { Course, CourseStatus, ParsedSchedule, TermInfo } from "./schema";

export type DateRange = { start: Date; end: Date };

/**
 * Parse date range from Quest (DD/MM/YYYY) like "05/01/2026 - 06/04/2026"
 */
function parseQuestDateRange(dateStr: string): DateRange | null {
    const parts = dateStr.split(" - ").map((s) => s.trim());
    if (parts.length !== 2) return null;

    const parseDate = (str: string): Date | null => {
        const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match) return null;
        return new Date(
            Number.parseInt(match[3], 10),
            Number.parseInt(match[2], 10) - 1, // Month is 2nd group
            Number.parseInt(match[1], 10), // Day is 1st group
        );
    };

    const start = parseDate(parts[0]);
    const end = parseDate(parts[1]);
    if (!start || !end) return null;

    return { start, end };
}

/**
 * Parse date range from User Input (Locale dependent-ish)
 */
export function parseUserDateRange(dateStr: string): DateRange | null {
    const parts = dateStr.split(" - ").map((s) => s.trim());
    if (parts.length !== 2) return null;

    const start = new Date(parts[0]);
    const end = new Date(parts[1]);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        return null;

    return { start, end };
}

export class ParserError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ParserError";
    }
}

/**
 * Parses the raw text output from Quest "My Class Schedule" list view.
 * Uses a keyword-driven state machine approach for robustness.
 * @param input Raw text string from Quest
 * @returns ParsedSchedule object with term info and courses
 * @throws ParserError if input is invalid or structure is unrecognized
 */
export function parseSchedule(input: string): ParsedSchedule {
    const lines = input
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    // 1. Find Term Info (Header)
    // Looking for "Season Year | Level | Institution"
    // e.g. "Winter 2026 | Undergraduate | University of Waterloo"
    const termLineIndex = lines.findIndex((l) =>
        /^[A-Z][a-z]+ \d{4} \| .+ \| .+$/.test(l),
    );

    if (termLineIndex === -1) {
        throw new ParserError(
            "Could not find term information line (e.g., 'Winter 2026 | ...')",
        );
    }

    const termLine = lines[termLineIndex];
    const [seasonYear, level, institution] = termLine.split(" | ");
    const [season, year] = seasonYear.split(" ");
    const term: TermInfo = { season, year, level, institution };

    // 2. State Machine for parsing courses
    const courses: Course[] = [];
    let currentCourse: Partial<Course> | null = null;
    let inSessionBlock = false;

    // Regex patterns
    // Matches "CS 136 - Elementary..." or "JS 101 - ..."
    const courseHeaderRegex = /^([A-Z]{2,10}\s\d{1,4}[A-Z]?) - (.+)$/;
    // Matches "Status Units Grading" header
    const statusHeaderRegex = /^Status\s+Units\s+Grading/;
    // Matches "Class Nbr Section Component" header
    const sessionHeaderRegex = /^Class Nbr\s+Section\s+Component/;
    // Matches start of a session row (class number)
    const classNumberRegex = /^\d{4,5}$/;

    for (let i = termLineIndex + 1; i < lines.length; i++) {
        const line = lines[i];

        // CHECK: New Course Header
        const courseMatch = line.match(courseHeaderRegex);
        if (courseMatch) {
            // Push previous course if valid
            if (currentCourse) {
                if (currentCourse.courseCode) {
                    courses.push(currentCourse as Course);
                }
            }

            // Init new course
            currentCourse = {
                courseCode: courseMatch[1],
                courseName: courseMatch[2],
                sessions: [],
                // Defaults
                status: "Enrolled",
                units: 0,
                grading: "Unknown",
            };
            inSessionBlock = false;
            continue;
        }

        if (!currentCourse) continue;

        // CHECK: Status/Units/Grading Block
        if (statusHeaderRegex.test(line)) {
            inSessionBlock = false;
            // Look ahead for values. We expect:
            // Status (Enrolled/Dropped/...)
            // Units (Number)
            // Grading (String)
            // These might be on separate lines i+1, i+2, i+3

            // Heuristic: check if next line is a valid status
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                if (["Enrolled", "Dropped", "Waitlisted"].includes(nextLine)) {
                    currentCourse.status = nextLine as CourseStatus;
                    // Try to consume more if they look correct
                    if (i + 2 < lines.length) {
                        const unitsVal = parseFloat(lines[i + 2]);
                        if (!Number.isNaN(unitsVal)) {
                            currentCourse.units = unitsVal;
                            i += 2; // Advanced past status and units

                            if (i + 1 < lines.length) {
                                // Next might be grading
                                currentCourse.grading = lines[i + 1];
                                i += 1;
                            }
                        } else {
                            // Maybe units missed? advance just 1 for status
                            i += 1;
                        }
                    }
                }
            }
            continue;
        }

        // CHECK: Session Header
        if (sessionHeaderRegex.test(line)) {
            inSessionBlock = true;
            continue;
        }

        // CHECK: Session Row
        // Only try to parse session if we are in a session block and line looks like a class number
        if (inSessionBlock && classNumberRegex.test(line)) {
            // We need to capture ~7 lines for a full session
            // Fields: Class# | Section | Component | Days & Times | Room | Instructor | Dates
            // Some checks to ensure we don't read garbage
            if (i + 6 < lines.length) {
                const classNumber = parseInt(line, 10);
                const section = lines[i + 1];
                const component = lines[i + 2];
                const daysAndTimes = lines[i + 3];
                const room = lines[i + 4];
                const instructor = lines[i + 5];
                const dates = lines[i + 6];

                // Validate structure loosely
                // Section is usually 3 digits (001) or similar.
                // Component is uppercase 3-4 chars (LEC, TUT).
                if (section.length <= 5 && /^[A-Z]{3,4}$/.test(component)) {
                    const dateRange = parseQuestDateRange(dates);
                    if (dateRange) {
                        currentCourse.sessions?.push({
                            classNumber,
                            section,
                            component,
                            daysAndTimes,
                            room,
                            instructor,
                            startDate: dateRange.start,
                            endDate: dateRange.end,
                        });
                    } else {
                        console.warn(
                            `Invalid date range for session ${classNumber} in course ${currentCourse.courseCode}: ${dates}`,
                        );
                    }

                    // Advance index to skip these lines
                    i += 6;
                }
            }
        }
    }

    // Push final course
    if (currentCourse?.courseCode) {
        courses.push(currentCourse as Course);
    }

    if (courses.length === 0) {
        // Fallback or warning?
        // If we found a term but no courses, it returns empty list which is valid.
    }

    return {
        term,
        courses,
    };
}
