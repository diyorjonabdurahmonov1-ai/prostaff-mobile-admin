import { useBottomTabBarHeight } from 'expo-router/js-tabs';

/**
 * How much clear space a scrolling screen needs below its content.
 *
 * The tab bar floats *over* the screen rather than shortening it: on Android
 * nothing insets a ScrollView for it, so a list that ends flush with the window
 * ends underneath the bar. Every tab used to hard-code `paddingBottom: 32`, a
 * number picked as breathing room and never measured against the bar — which is
 * around 50pt plus the gesture inset. The last row of every list was hidden.
 *
 * `useBottomTabBarHeight` is the bar's real height including the safe-area
 * padding it applies itself, so this stays right on a phone with buttons, a
 * phone with a gesture pill, and an iPad.
 */
export function useTabContentInset(extra = 24): number {
  return useBottomTabBarHeight() + extra;
}
