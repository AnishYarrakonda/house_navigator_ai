# Rule: Accessibility & Human-Centered Design

The crisis side will be used on cracked screens, in bad light, on old Android, by people in distress who may have low literacy and may not speak English. These are the track's literal words — treat them as acceptance criteria.

## Crisis side

- **Icon-first, low-literacy.** Every action = a glyph + a short *localized* word. The crisis home screen is **one button**: "I need help" (icon + word). Need selection is **large icon tiles** (bed / food / shower / medical / talk).
- **Multilingual from the first screen**, not buried in settings. Ship **English + Spanish** for the demo via `react-i18next`. No hard-coded user-facing strings — all through the i18n dictionary, including agent-drafted "what to expect" cards.
- **Low-end / low-data.** Works on old Android; lazy-load map tiles; degrade gracefully on weak signal. PWA-installable. *(Stretch: offline cache of nearest nodes.)* Watch bundle size and avoid heavy deps on the crisis path.
- **High contrast + large targets by default (WCAG AA).** Minimum tap target **44×44px**; contrast ratio ≥ 4.5:1 for text. Don't rely on color alone to convey capacity state (green/amber/red) — pair with shape/label.
- **QR / short-code onboarding** so an outreach worker can hand someone the app in ~5 seconds, no app-store friction.

## Trauma-informed copy

- "I need help," **not** "Submit request." "Somewhere safe tonight," **not** "Emergency shelter intake."
- **No urgency-shaming, no countdowns**, no red error states that read as punishment.
- Reassuring, plain language. Agent-drafted cards (Navigator) must pass the same copy bar — short, warm, concrete: "what to expect when you arrive."
- Steer gently away from asking the person for legal name / precise location (see `privacy.md`).

## Practical checks before calling crisis-side UI done

- Keyboard + screen-reader reachable; meaningful `aria-label`s on icon-only controls.
- Works at 200% zoom and on a ~360px-wide viewport.
- Every string resolves in both `en` and `es`.
- No flow requires creating an account or typing a password.
