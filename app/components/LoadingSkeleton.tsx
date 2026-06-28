export default function LoadingSkeleton() {
    return (
        <div className="animate-pulse" role="status" aria-live="polite">
            <span className="sr-only">Loading job data…</span>
            <div className="border border-gray-800 rounded-xl bg-gray-900 p-6 space-y-6" aria-hidden="true">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="h-6 w-32 bg-gray-800 rounded mb-2"></div>
                        <div className="h-4 w-24 bg-gray-800 rounded"></div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-lg p-3">
                        <div className="h-4 w-12 bg-gray-700 rounded mb-2"></div>
                        <div className="h-4 w-28 bg-gray-700 rounded"></div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                        <div className="h-4 w-12 bg-gray-700 rounded mb-2"></div>
                        <div className="h-4 w-28 bg-gray-700 rounded"></div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                        <div className="h-4 w-12 bg-gray-700 rounded mb-2"></div>
                        <div className="h-4 w-28 bg-gray-700 rounded"></div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="border border-gray-800 rounded-lg p-4 bg-gray-900">
                        <div className="h-4 w-24 bg-gray-800 rounded mb-2"></div>
                        <div className="h-4 w-32 bg-gray-800 rounded"></div>
                    </div>
                    <div className="border border-gray-800 rounded-lg p-4 bg-gray-900">
                        <div className="h-4 w-24 bg-gray-800 rounded mb-2"></div>
                        <div className="h-4 w-32 bg-gray-800 rounded"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
