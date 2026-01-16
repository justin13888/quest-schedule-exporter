import type React from "react";
import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import type { ClassSession, Course, ParsedSchedule } from "@/lib/schema";

interface EditableCourseTableProps {
    schedule: ParsedSchedule | null;
    onScheduleChange: (schedule: ParsedSchedule) => void;
}

interface EditableCellProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    type?: "text" | "number";
}

const EditableCell: React.FC<EditableCellProps> = ({
    value,
    onChange,
    className = "",
    type = "text",
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditValue(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleBlur = () => {
        setIsEditing(false);
        if (editValue !== value) {
            onChange(editValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleBlur();
        } else if (e.key === "Escape") {
            setEditValue(value);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type={type}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={`w-full px-1 py-0.5 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
            />
        );
    }

    return (
        <button
            type="button"
            onClick={() => setIsEditing(true)}
            className={`cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded transition-colors text-left w-full ${className}`}
            title="Click to edit"
        >
            {value || <span className="text-gray-400 italic">empty</span>}
        </button>
    );
};

export const EditableCourseTable: React.FC<EditableCourseTableProps> = ({
    schedule,
    onScheduleChange,
}) => {
    if (!schedule) return null;

    const updateCourse = (courseIdx: number, updates: Partial<Course>) => {
        const newCourses = [...schedule.courses];
        newCourses[courseIdx] = { ...newCourses[courseIdx], ...updates };
        onScheduleChange({ ...schedule, courses: newCourses });
    };

    const updateSession = (
        courseIdx: number,
        sessionIdx: number,
        updates: Partial<ClassSession>,
    ) => {
        const newCourses = [...schedule.courses];
        const newSessions = [...newCourses[courseIdx].sessions];
        newSessions[sessionIdx] = { ...newSessions[sessionIdx], ...updates };
        newCourses[courseIdx] = {
            ...newCourses[courseIdx],
            sessions: newSessions,
        };
        onScheduleChange({ ...schedule, courses: newCourses });
    };

    return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-white/50 backdrop-blur-sm p-4 rounded-xl border border-white/20 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">
                        {schedule.term.season} {schedule.term.year}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {schedule.term.institution} • {schedule.term.level}
                    </p>
                </div>
                <div className="mt-2 md:mt-0 flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-600">
                        {schedule.courses.length} Course
                        {schedule.courses.length !== 1 ? "s" : ""} Found
                    </span>
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        💡 Click any field to edit
                    </span>
                </div>
            </div>

            <div className="grid gap-4">
                {schedule.courses.map((course, courseIdx) => (
                    <div
                        key={`${course.courseCode}-${courseIdx}`}
                        className="bg-white/70 backdrop-blur-md rounded-xl border border-white/40 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200"
                    >
                        {/* Course Header */}
                        <div className="p-4 border-b border-gray-100 bg-white/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm shadow-sm border border-blue-100">
                                    {course.courseCode.split(" ")[0]}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">
                                        <EditableCell
                                            value={course.courseCode}
                                            onChange={(v) =>
                                                updateCourse(courseIdx, {
                                                    courseCode: v,
                                                })
                                            }
                                        />
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        <EditableCell
                                            value={course.courseName}
                                            onChange={(v) =>
                                                updateCourse(courseIdx, {
                                                    courseName: v,
                                                })
                                            }
                                        />
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-mono text-gray-400">
                                    {course.units.toFixed(2)} Units
                                </span>
                                <StatusBadge status={course.status} />
                            </div>
                        </div>

                        {/* Sessions Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                                    <tr>
                                        <th className="px-4 py-2 font-medium">
                                            Class #
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Section
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Type
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Time & Days
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Location
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Instructor
                                        </th>
                                        <th className="px-4 py-2 font-medium">
                                            Dates
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {course.sessions.map(
                                        (session, sessionIdx) => (
                                            <tr
                                                key={`${session.classNumber}-${session.section}-${sessionIdx}`}
                                                className="hover:bg-gray-50/30 transition-colors"
                                            >
                                                <td className="px-4 py-2.5 font-mono text-gray-400 text-xs">
                                                    {session.classNumber}
                                                </td>
                                                <td className="px-4 py-2.5 font-medium text-gray-700">
                                                    <EditableCell
                                                        value={session.section}
                                                        onChange={(v) =>
                                                            updateSession(
                                                                courseIdx,
                                                                sessionIdx,
                                                                { section: v },
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                                        <EditableCell
                                                            value={
                                                                session.component
                                                            }
                                                            onChange={(v) =>
                                                                updateSession(
                                                                    courseIdx,
                                                                    sessionIdx,
                                                                    {
                                                                        component:
                                                                            v,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 font-medium text-gray-900">
                                                    <EditableCell
                                                        value={
                                                            session.daysAndTimes
                                                        }
                                                        onChange={(v) =>
                                                            updateSession(
                                                                courseIdx,
                                                                sessionIdx,
                                                                {
                                                                    daysAndTimes:
                                                                        v,
                                                                },
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2.5 text-gray-600">
                                                    <EditableCell
                                                        value={session.room}
                                                        onChange={(v) =>
                                                            updateSession(
                                                                courseIdx,
                                                                sessionIdx,
                                                                { room: v },
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2.5 text-gray-800">
                                                    <EditableCell
                                                        value={
                                                            session.instructor
                                                        }
                                                        onChange={(v) =>
                                                            updateSession(
                                                                courseIdx,
                                                                sessionIdx,
                                                                {
                                                                    instructor:
                                                                        v,
                                                                },
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                                                    <EditableCell
                                                        value={
                                                            session.startEndDates
                                                        }
                                                        onChange={(v) =>
                                                            updateSession(
                                                                courseIdx,
                                                                sessionIdx,
                                                                {
                                                                    startEndDates:
                                                                        v,
                                                                },
                                                            )
                                                        }
                                                    />
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
