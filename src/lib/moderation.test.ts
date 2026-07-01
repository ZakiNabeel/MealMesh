import { moderateText } from '@/lib/moderation';

describe('moderateText', () => {
  it('allows normal cooking talk', () => {
    expect(moderateText('Made this chicken karahi tonight, so good with fresh naan!').ok).toBe(true);
    expect(moderateText('Any tips for a gluten-free biryani?').ok).toBe(true);
  });

  it('blocks slurs / severe profanity (incl. simple obfuscation)', () => {
    expect(moderateText('you r3tard').ok).toBe(false);
    expect(moderateText('f a g g o t').ok).toBe(false);
  });

  it('blocks spam shapes', () => {
    expect(moderateText('MAKE MONEY FAST click here to win crypto giveaway').ok).toBe(false);
    expect(moderateText('check http://a.com http://b.com http://c.xyz now').ok).toBe(false);
    expect(moderateText('AAAAAAAAAAAAAAAAAA').ok).toBe(false);
  });

  it('enforces a minimum length when asked', () => {
    expect(moderateText('a', { min: 2 }).ok).toBe(false);
    expect(moderateText('ok', { min: 2 }).ok).toBe(true);
  });

  it('treats empty optional text as fine', () => {
    expect(moderateText('', { min: 0 }).ok).toBe(true);
    expect(moderateText(null).ok).toBe(true);
  });
});
