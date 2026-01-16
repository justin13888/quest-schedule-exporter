import { z } from "zod";

/**
 * Represents the status of a course enrollment.
 * @example "Enrolled", "Dropped", "Waitlisted"
 */
export const CourseStatusSchema = z.enum(["Enrolled", "Dropped", "Waitlisted"]);
export type CourseStatus = z.infer<typeof CourseStatusSchema>;

/**
 * Represents the type of instruction component.
 * Common examples: "LEC" (Lecture), "TUT" (Tutorial), "LAB" (Laboratory).
 */
export const ComponentTypeSchema = z.enum([
    "LEC",
    "TUT",
    "LAB",
    "WRK",
    "SEM",
    "PRJ",
    "TST",
]);
export type ComponentType = z.infer<typeof ComponentTypeSchema>;

/**
 * Represents a single scheduled session for a course, including time, location, and instructor.
 */
export const ClassSessionSchema = z.object({
    classNumber: z.number(),
    section: z.string(),
    component: ComponentTypeSchema.or(z.string()), // Fallback for unknown components
    daysAndTimes: z.string(),
    room: z.string(),
    instructor: z.string(),
    startDate: z.date(),
    endDate: z.date(),
});
export type ClassSession = z.infer<typeof ClassSessionSchema>;

/**
 * Represents a specific course in the schedule, containing details and scheduled sessions.
 * @example
 * {
 *   courseCode: "CS 136",
 *   courseName: "Elementary Algorithm Design and Data Abstraction",
 *   units: 0.5,
 *   grading: "Numeric Grading",
 *   status: "Enrolled"
 * }
 */
export const CourseSchema = z.object({
    courseCode: z.string(),
    courseName: z.string(),
    status: CourseStatusSchema,
    units: z.number(),
    grading: z.string(),
    grade: z.string().optional(),
    sessions: z.array(ClassSessionSchema),
});
export type Course = z.infer<typeof CourseSchema>;

/**
 * Contains metadata about the academic term and institution.
 * @example
 * {
 *   season: "Winter",
 *   year: "2026",
 *   level: "Undergraduate",
 *   institution: "University of Waterloo"
 * }
 */
export const TermInfoSchema = z.object({
    season: z.string(),
    year: z.string(),
    level: z.string(),
    institution: z.string(),
});
export type TermInfo = z.infer<typeof TermInfoSchema>;

/**
 * The root container for the parsed schedule data, including term info and the list of courses.
 */
export const ParsedScheduleSchema = z.object({
    term: TermInfoSchema, // e.g. Winter 2026 | Undergraduate | University of Waterloo
    courses: z.array(CourseSchema),
});
export type ParsedSchedule = z.infer<typeof ParsedScheduleSchema>;
