import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the prototype chapter directory', () => {
    const html = renderToString(<App initialChapters={[{
      id: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
      name: 'New York City DSA',
      shortName: 'NYC-DSA',
      collection: 'org.dsa.profile.chapter',
      handle: 'nyc.dsausa.org',
      did: 'did:plc:nycdsa',
      jurisdiction: 'New York City, NY',
      trustLabel: 'mock-official',
      status: 'active',
    }]} />);
    expect(html).toContain('Chapter directory');
    expect(html).toContain('Mocked public chapter records');
    expect(html).toContain('org.dsa.profile.chapter');
  });
});
