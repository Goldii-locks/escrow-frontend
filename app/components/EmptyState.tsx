interface EmptyStateProps {
    title: string;
    description: string;
    icon?: string;
}

export default function EmptyState({ title, description, icon = "🗂️" }: EmptyStateProps) {
    return (
        <div
            data-testid="empty-state"
            className="flex flex-col items-center justify-center text-center gap-2 border border-gray-800 rounded-xl bg-gray-900 p-10 animate-fade-in"
        >
            <span aria-hidden="true" className="text-4xl">
                {icon}
            </span>
            <p data-testid="empty-state-title" className="text-white font-semibold">
                {title}
            </p>
            <p data-testid="empty-state-description" className="text-gray-400 text-sm max-w-sm">
                {description}
            </p>
        </div>
    );
}
