import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the
 * client side for web.
 *
 * WHY `useSyncExternalStore` RATHER THAN AN EFFECT. This previously held a
 * `hasHydrated` flag in state and set it to true inside `useEffect`, which is
 * setState-in-effect: it renders once with the wrong value and immediately
 * re-renders with the right one. React's own lint rule flags it, and it was the
 * only lint error in the repository — enough to make `npm run verify` stop
 * before it ever reached the tests.
 *
 * `useSyncExternalStore` is the sanctioned way to ask "am I on the client yet".
 * It takes separate client and server snapshots, so the server renders `false`
 * and the client renders `true` from the first paint. No effect, no extra
 * render, and hydration still matches because the two snapshots are declared
 * rather than raced.
 *
 * The subscription is deliberately empty: hydration happens exactly once and
 * never changes afterwards, so there is nothing to subscribe to.
 */
const subscribeToNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(subscribeToNothing, onClient, onServer);
  const colorScheme = useRNColorScheme();

  return hasHydrated ? colorScheme : 'light';
}
