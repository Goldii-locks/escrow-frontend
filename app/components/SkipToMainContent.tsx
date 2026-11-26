export default function SkipToMainContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-gray-950 focus:outline-2 focus:outline-offset-2"
    >
      Skip to main content
    </a>
  );
}
