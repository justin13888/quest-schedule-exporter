import { useEffect, useRef, useState } from "react";
import { downloadIcs, generateScheduleIcs } from "../lib/icsExport";
import { parseSchedule } from "../lib/parser";
import type { ParsedSchedule } from "../lib/schema";
import { decodeScheduleFromUrl, encodeScheduleToUrl } from "../lib/urlState";
import { EditableCourseTable } from "./EditableCourseTable";

export const ScheduleExporter = () => {
    const [input, setInput] = useState("");
    const [schedule, setSchedule] = useState<ParsedSchedule | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [summaryTemplate, setSummaryTemplate] = useState(
        "@code @type in @location",
    );
    const [descriptionTemplate, setDescriptionTemplate] = useState(
        "@code-@section: @name (@type) in @location with @prof",
    );

    const hasInitialized = useRef(false);

    // Load from URL on mount
    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        const savedInput = decodeScheduleFromUrl();
        if (savedInput) {
            setInput(savedInput);
            // If we have data from URL, parse it immediately
            try {
                const result = parseSchedule(savedInput);
                setSchedule(result);
            } catch (err) {
                console.error("Failed to parse saved schedule:", err);
            }
        }
    }, []);

    const handleParse = () => {
        if (!input.trim()) {
            setError("Please paste your schedule data first.");
            return;
        }

        setIsParsing(true);
        setError(null);

        try {
            const result = parseSchedule(input);
            setSchedule(result);
            encodeScheduleToUrl(input);
        } catch (err) {
            console.error(err);
            setError(
                err instanceof Error
                    ? err.message
                    : "An unknown error occurred",
            );
            setSchedule(null);
        } finally {
            setIsParsing(false);
        }
    };

    const handleExport = () => {
        if (!schedule) return;

        try {
            const { icsContent, warnings } = generateScheduleIcs(
                schedule,
                summaryTemplate,
                descriptionTemplate,
            );

            if (warnings.length > 0) {
                const message =
                    "The following sessions were excluded from the export:\n\n" +
                    warnings.map((w) => `• ${w}`).join("\n") +
                    "\n\nDo you want to continue downloading the schedule?";

                if (!window.confirm(message)) {
                    return;
                }
            }

            const filename = `schedule_${schedule.term.season.toLocaleLowerCase()}_${schedule.term.year}.ics`;
            downloadIcs(icsContent, filename);
        } catch (err) {
            console.error("Failed to generate ICS:", err);
            setError("Failed to generate calendar file. Please try again.");
        }
    };

    const handleReset = () => {
        setInput("");
        setSchedule(null);
        setError(null);
        encodeScheduleToUrl("");
    };

    const handleScheduleChange = (updatedSchedule: ParsedSchedule) => {
        setSchedule(updatedSchedule);
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-8">
            {/* Header / Instructions */}
            <div className="space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600">
                        Quest Schedule Exporter
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Convert your UWaterloo Quest schedule into a clean,
                        readable format.
                    </p>
                </div>

                {!schedule && (
                    <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm">
                                ?
                            </span>
                            How to use
                        </h3>
                        <ol className="grid gap-3 sm:grid-cols-2 text-sm text-gray-600 list-decimal list-inside marker:text-blue-500 marker:font-semibold">
                            <li>
                                Login at{" "}
                                <a
                                    href="https://quest.pecs.uwaterloo.ca/psp/SS/?cmd=login"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline"
                                >
                                    Quest
                                </a>
                            </li>
                            <li>
                                Click <strong>Enroll</strong>
                            </li>
                            <li>
                                Choose your term and click{" "}
                                <strong>Continue</strong>
                            </li>
                            <li>
                                Ensure you are in <strong>"List View"</strong>
                            </li>
                            <li>
                                Select All (
                                <kbd className="font-mono bg-gray-100 px-1 rounded">
                                    Ctrl+A
                                </kbd>
                                ) and Copy (
                                <kbd className="font-mono bg-gray-100 px-1 rounded">
                                    Ctrl+C
                                </kbd>
                                )
                            </li>
                            <li>Paste into the box below</li>
                        </ol>
                    </div>
                )}
            </div>

            {/* Input Area - shown when no schedule parsed yet */}
            {!schedule && (
                <div className="space-y-4">
                    <label
                        htmlFor="paste-area"
                        className="block text-sm font-medium text-gray-700 ml-1"
                    >
                        Paste Schedule Data
                    </label>
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-linear-to-r from-blue-500 to-purple-600 rounded-xl opacity-20 group-focus-within:opacity-100 transition duration-500 blur" />
                        <textarea
                            id="paste-area"
                            className="relative w-full h-48 p-4 rounded-xl border-gray-200 bg-white/80 backdrop-blur shadow-sm focus:ring-0 focus:outline-none resize-none font-mono text-xs md:text-sm transition-all"
                            placeholder="Paste your copied Quest schedule here..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleParse}
                        disabled={isParsing || !input.trim()}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-200 hover:shadow-xl transition-all active:scale-95 flex items-center gap-2"
                    >
                        {isParsing ? (
                            <>
                                <svg
                                    className="animate-spin h-4 w-4"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <title>Loading</title>
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        fill="none"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                Parsing...
                            </>
                        ) : (
                            "Parse Schedule"
                        )}
                    </button>

                    {error && (
                        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                            <svg
                                className="h-5 w-5 shrink-0 text-red-500"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <title>Error</title>
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <div>
                                <p className="font-semibold">Parsing Failed</p>
                                <p className="mt-1 opacity-90">{error}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Reset button - shown when schedule exists */}
            {schedule && (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50/70 border border-red-200 rounded-lg hover:bg-red-50 transition-all shadow-sm"
                    >
                        🗑️ Reset
                    </button>
                </div>
            )}

            {/* Editable Results */}
            <EditableCourseTable
                schedule={schedule}
                onScheduleChange={handleScheduleChange}
            />

            {/* Export Actions */}
            {schedule && (
                <div className="p-6 bg-white/60 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-sm space-y-4">
                    <h3 className="font-semibold text-gray-900">
                        Export Options
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label
                                htmlFor="summary-template"
                                className="text-xs font-medium text-gray-500 uppercase"
                            >
                                Summary Template
                            </label>
                            <input
                                id="summary-template"
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white/50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                value={summaryTemplate}
                                onChange={(e) =>
                                    setSummaryTemplate(e.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <label
                                htmlFor="description-template"
                                className="text-xs font-medium text-gray-500 uppercase"
                            >
                                Description Template
                            </label>
                            <input
                                id="description-template"
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white/50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                value={descriptionTemplate}
                                onChange={(e) =>
                                    setDescriptionTemplate(e.target.value)
                                }
                            />
                        </div>
                    </div>
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={handleExport}
                            className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-medium rounded-lg shadow-lg shadow-gray-200 hover:shadow-xl transition-all active:scale-95"
                        >
                            Export iCalendar (.ics)
                        </button>
                    </div>
                    <p className="text-xs text-gray-400">
                        Possible placeholders: @code, @section, @name, @type,
                        @location, @prof
                    </p>
                </div>
            )}
        </div>
    );
};
