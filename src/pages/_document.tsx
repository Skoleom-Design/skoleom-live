import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  return (
    <Html lang="fr">
      <Head>
        {/* Skoleom extension — styles */}
        <link
          rel="stylesheet"
          href={`${apiBase}/static/css/content.css`}
        />

        {/* Direction artistique Skoleom Universe — Poppins (texte) + Anton (titres) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Anton&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />

        {/* Skoleom extension — floating capsule widget */}
        <script
          src={`${apiBase}/static/js/453.js`}
          defer
        />
        <script
          src={`${apiBase}/static/js/content.js`}
          defer
        />
      </body>
    </Html>
  );
}
