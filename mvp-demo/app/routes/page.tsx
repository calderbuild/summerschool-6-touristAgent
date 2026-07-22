import { I18nProvider } from "@/lib/i18n";
import App from "@/components/App";

// The visual route browser (profile picker + spine + map). The chat at "/" is
// the primary interface; this stays as a direct way to browse all prepared routes.
export default function RoutesPage() {
  return (
    <I18nProvider>
      <App />
    </I18nProvider>
  );
}
