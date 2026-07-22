import { I18nProvider } from "@/lib/i18n";
import ChatShell from "@/components/chat/ChatShell";

export default function Page() {
  return (
    <I18nProvider>
      <ChatShell />
    </I18nProvider>
  );
}
