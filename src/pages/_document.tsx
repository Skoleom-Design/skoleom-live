import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        {/* Skoleom extension — styles. Chemin relatif — proxy Next (/static/*) vers Nest en
            interne, voir next.config.js. Une URL absolue casserait en prod sur Render. */}
        <link rel="stylesheet" href="/static/css/content.css" />

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
        <script src="/static/js/453.js" defer />
        <script src="/static/js/content.js" defer />
      </body>
    </Html>
  );
}
