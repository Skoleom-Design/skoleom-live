import type { AppProps } from 'next/app';
import { LanguageProvider } from '../client/i18n/LanguageContext';
import '../global.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <LanguageProvider>
      <Component {...pageProps} />
    </LanguageProvider>
  );
}
