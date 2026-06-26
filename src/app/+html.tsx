/**
 * Web-only document shell (Expo Router). Wraps every web page in the static
 * HTML that the server renders before React boots — used here to set the
 * MealMesh favicon, viewport, and theme color. Has no effect on native.
 */

import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="description" content="One household. Many diets. One plan — and one grocery list. MealMesh builds a weekly meal plan that respects every diet at your table." />
        <meta name="theme-color" content="#9DBA8C" />

        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />

        <title>MealMesh — one household, many diets, one plan</title>

        {/* Disable body scrolling on native-feeling app screens; the website
            landing manages its own scroll. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
