import Script from 'next/script';

interface Props {
  /** GTM container id, e.g. "GTM-XXXXXXX". Nothing renders when empty/undefined. */
  id?: string;
}

/**
 * Google Tag Manager loader. Renders nothing unless `id` is a non-empty
 * string, so every environment that doesn't set GTM_ID (all current ones)
 * loads no analytics at all.
 *
 * This component only ever emits the standard GTM bootstrap snippet with the
 * container id — it never has access to, and must never be given, anything a
 * visitor typed (see the purity guard test in Gtm.test.tsx).
 */
export default function Gtm({ id }: Props) {
  if (!id) return null;

  return (
    <>
      <Script id="gtm-script" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`}
      </Script>
      {/*
        React does not mount children of <noscript> on the client (it's
        inert wherever scripting is enabled, which is precisely when React
        is running), so the fallback iframe has to be injected as raw HTML
        via dangerouslySetInnerHTML rather than JSX children — this is the
        standard workaround for GTM's noscript tag in React apps.
      */}
      <noscript
        dangerouslySetInnerHTML={{
          __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
        }}
      />
    </>
  );
}
