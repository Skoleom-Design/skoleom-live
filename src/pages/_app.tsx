import type { AppProps } from 'next/app';
import { LanguageProvider } from '../client/i18n/LanguageContext';
import AssistanceFlottante from '../client/components/Assistance/AssistanceFlottante';
import '../global.css';
import '../client/components/Assistance/AssistanceFlottante.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <LanguageProvider>
      <Component {...pageProps} />
      <AssistanceFlottante />
    </LanguageProvider>
  );
}
