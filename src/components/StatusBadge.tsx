export const StatusBadge = ({ status }: { status: string }) => {
    let colorClass = "bg-gray-100 text-gray-800";
    if (status === "Enrolled")
        colorClass = "bg-green-100 text-green-800 border-green-200";
    else if (status === "Dropped")
        colorClass = "bg-red-100 text-red-800 border-red-200";
    else if (status === "Waitlisted")
        colorClass = "bg-yellow-100 text-yellow-800 border-yellow-200";

    return (
        <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}
        >
            {status}
        </span>
    );
};
