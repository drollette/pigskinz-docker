import packageJson from "../../package.json";

export function Footer() {
  return (
    <footer className="py-2 px-4">
      <div className="flex justify-end">
        <span className="text-xs text-gray-500">v{packageJson.version}</span>
      </div>
    </footer>
  );
}
