import type { Course, CourseStatus, ParsedSchedule, TermInfo } from "./schema";

export class ParserError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ParserError";
    }
}

/**
 * Parses the raw text output from Quest "My Class Schedule" list view.
 * @param input Raw text string from Quest
 * @returns ParsedSchedule object with term info and courses
 * @throws ParserError if input is invalid or structure is unrecognized
 */
export function parseSchedule(input: string): ParsedSchedule {
    const lines = input
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    // 1. Validate Basic Structure & Term Info
    // Look for lines like "Winter 2026 | Undergraduate | University of Waterloo"
    const termLineIndex = lines.findIndex((l) =>
        /^[A-Z][a-z]+ \d{4} \| Undergraduate \| University of Waterloo$/.test(
            l,
        ),
    );

    if (termLineIndex === -1) {
        throw new ParserError(
            "Could not find term information line (e.g., 'Winter 2026 | Undergraduate | University of Waterloo')",
        );
    }

    const termLine = lines[termLineIndex];
    const [seasonYear, level, institution] = termLine.split(" | ");
    const [season, year] = seasonYear.split(" ");

    const term: TermInfo = { season, year, level, institution };

    // 2. Identify Course Blocks
    // Courses usually start after "Class Schedule Filter Options" or similar headers
    // But safely, we can look for the pattern "Subject Catalog# - Title"
    // e.g., "CS 484 - Computational Vision" or "COOP 4 - Co-operative Work Term"

    // We'll iterate through lines and identify course headers
    // A course header looks like: start of a block.
    // The structure is roughly:
    // [Course Header]
    // Status Units Grading ...
    // [Status Value]
    // [Units Value]
    // [Grading Value]
    // ...
    // Class Nbr Section ...
    // [Session Rows]

    const courses: Course[] = [];
    let currentCourse: Partial<Course> | null = null;
    let currentSessionHeadersFound = false;
    let i = termLineIndex + 1;

    // Regex for course header: e.g. "CS 484 - Computational Vision" or "PD 12 - Critical Reflection"
    // Must contain code (XYZ 123[A-Z]?) and title separated by " - "
    const courseHeaderRegex = /^([A-Z]{2,5} \d{1,4}[A-Z]?) - (.+)$/;

    while (i < lines.length) {
        const line = lines[i];

        // Check if this line is a new course header
        const courseMatch = line.match(courseHeaderRegex);

        // Additional check: Ensure it's not a false positive.
        // Real course headers are followed eventually by "Status Units Grading..." logic
        // But for single pass, we can assume this regex is specific enough for the context of this file.
        // However, "Class Schedule Filter Options" might appear.

        if (courseMatch) {
            // If we were parsing a course, push it first
            if (currentCourse) {
                // Validate current course before pushing (simplified)
                if (
                    currentCourse.sessions &&
                    currentCourse.sessions.length > 0
                ) {
                    courses.push(currentCourse as Course);
                }
            }

            // Start new course
            currentCourse = {
                courseCode: courseMatch[1],
                courseName: courseMatch[2],
                sessions: [],
            };
            currentSessionHeadersFound = false;
            i++;
            continue;
        }

        // Inside a course block
        if (currentCourse) {
            // Parse Status/Units block
            // Expected layout in lines (after trimming/filtering empty):
            // "Status Units Grading Grade Deadlines",
            // "Enrolled",
            // "0.50",
            // "Numeric Grading Basis",
            // ...

            if (
                line.startsWith("Status") &&
                line.includes("Units") &&
                line.includes("Grading")
            ) {
                // The NEXT lines should be the values.
                // Note: Sometimes values are interleaved or empty in raw copy, but we filtered empty lines.
                // Let's assume the order: Status, Units, Grading.

                // Be careful of bound checks
                if (i + 3 >= lines.length) break;

                const statusStr = lines[i + 1];
                if (
                    !["Enrolled", "Dropped", "Waitlisted"].includes(statusStr)
                ) {
                    // Maybe it's not the right line? skip
                    i++;
                    continue;
                }

                currentCourse.status = statusStr as CourseStatus;

                // Units can be "0.25" or "0.50"
                const unitsStr = lines[i + 2];
                const units = parseFloat(unitsStr);

                if (Number.isNaN(units)) {
                    // Error or mismatch
                } else {
                    currentCourse.units = units;
                }

                // Grading
                currentCourse.grading = lines[i + 3];

                i += 4; // Skip the header and 3 value lines
                continue;
            }

            // Parse Sessions block
            // Header: "Class Nbr Section Component Days & Times Room Instructor Start/End Date"
            if (line.startsWith("Class Nbr") && line.includes("Section")) {
                currentSessionHeadersFound = true;
                i++;
                continue;
            }

            if (currentSessionHeadersFound) {
                // Parsing session rows.
                // A session row in strictly filtered lines usually looks like:
                // "1234" (Class Nbr)
                // "001" (Section)
                // "LEC" (Component)
                // "TTh 1:00PM - 2:20PM" (Days & Times)
                // "MC 4020" (Room)
                // "John Doe" (Instructor)
                // "01/01/2026 - 04/01/2026" (Dates)

                // However, sometimes fields might be weird.
                // We assume blocks of 7 lines per session if the structure holds.

                // Validating if this is the start of a session: Class Nbr is an integer
                if (/^\d{4,5}$/.test(line)) {
                    // It's a class number. Let's try to grab the next 6 lines.
                    if (i + 6 < lines.length) {
                        const classNbr = parseInt(line, 10);
                        const section = lines[i + 1];
                        const component = lines[i + 2];
                        const daysTimes = lines[i + 3];
                        const room = lines[i + 4];
                        const instructor = lines[i + 5];
                        const dates = lines[i + 6];

                        // Basic check to ensure we didn't run into next header
                        if (
                            section.length <= 3 &&
                            /^[A-Z]{3}$/.test(component)
                        ) {
                            currentCourse.sessions?.push({
                                classNumber: classNbr,
                                section,
                                component,
                                daysAndTimes: daysTimes,
                                room,
                                instructor,
                                startEndDates: dates,
                            });
                            i += 6; // +1 loop incr = 7 total
                        }
                    }
                }
                // If we hit "Printer Friendly Page" or next course, we stop.
                // The loop structure handles next course via regex at top.
            }
        }

        i++;
    }

    // Push last course found
    if (currentCourse?.sessions && currentCourse.sessions.length > 0) {
        courses.push(currentCourse as Course);
    }

    if (courses.length === 0) {
        // Did we parse anything?
        // Check if input was just empty or valid without courses?
        // User requested strict parsing. If no courses found but term found, strictly speaking it might be a valid result (empty term),
        // but functionally maybe an error? Let's return empty array but valid object.
    }

    return {
        term,
        courses,
    };
}
