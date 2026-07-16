import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Gtm from './Gtm';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('<Gtm>', () => {
  it('renders nothing when id is empty/undefined', () => {
    const { container } = render(<Gtm />);
    expect(container).toBeEmptyDOMElement();
    // No GTM script should have been injected into the document either.
    expect(document.querySelector('script#gtm-script')).toBeNull();
  });

  it('injects the GTM snippet containing the id when id is set', () => {
    const { container } = render(<Gtm id="GTM-TEST123" />);

    // The bootstrap <script> is injected into document.body by next/script.
    const script = document.querySelector('script#gtm-script');
    expect(script).not.toBeNull();
    expect(script?.textContent).toContain('GTM-TEST123');
    expect(script?.textContent).toContain('www.googletagmanager.com/gtm.js');

    // The noscript iframe fallback renders in the component tree. jsdom runs
    // with scripting enabled, so <noscript> content is serialized as raw
    // text rather than parsed into child elements — assert on the markup.
    const noscript = container.querySelector('noscript');
    expect(noscript?.innerHTML).toContain(
      'https://www.googletagmanager.com/ns.html?id=GTM-TEST123',
    );
  });
});

// PURITY GUARD: user-entered data (addresses, search terms) must never be
// capable of reaching analytics. Gtm.tsx only ever receives a static,
// server-configured container id — it has no path to user input. This test
// enforces that invariant at the source level: the files that ever see a
// visitor's address/query string must not reference dataLayer, gtag(, or
// google_tag, which are the only mechanisms that could push data to GTM/GA.
// If this test fails, someone wired user input toward analytics — stop and
// reconsider before "fixing" the test.
describe('purity guard: user input never reaches analytics', () => {
  const forbidden = [/dataLayer/, /gtag\(/, /google_tag/];
  const sources: Array<[string, string]> = [
    ['components/Calculator.tsx', 'components/Calculator.tsx'],
    ['components/Results.tsx', 'components/Results.tsx'],
    ['lib/lookup/arcgis.ts', 'lib/lookup/arcgis.ts'],
  ];

  it.each(sources)('%s has no analytics hooks', (_label, relPath) => {
    const contents = readFileSync(join(process.cwd(), relPath), 'utf8');
    for (const pattern of forbidden) {
      expect(contents).not.toMatch(pattern);
    }
  });
});
