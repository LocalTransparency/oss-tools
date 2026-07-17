import { describe, it, expect, vi, afterEach } from 'vitest';
import { hamilton } from './hamilton';

describe('hamilton lookup source', () => {
  afterEach(() => vi.restoreAllMocks());

  it('identifies its county', () => {
    expect(hamilton.county).toBe('Hamilton');
  });

  it('delegates search to the county ArcGIS service and returns parsed candidates', async () => {
    const feature = {
      attributes: {
        PARCELNO: '160', STPRCLNO: '29', LOCADDRESS: '1234 CONNER ST', LOCCITY: 'Noblesville',
        LOCZIP: '46060', AVTOTGROSS: 350000, AVTAXYR: 2026, hmstd_code: 1,
        TAXDISTNAM: 'Noblesville City', PROPERTYREPORT: 'https://example.test/r',
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ features: [feature] }), { status: 200 }),
    ));
    const candidates = await hamilton.search('1234 conner st');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].taxDistrictName).toBe('Noblesville City');
    expect(candidates[0].grossAV).toBe(350000);
  });

  it('propagates upstream failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 500 })));
    await expect(hamilton.search('123 main st')).rejects.toThrow('upstream');
  });
});
