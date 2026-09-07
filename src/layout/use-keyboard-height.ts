import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Height of the on-screen keyboard, or 0 when it is down.
 *
 * The keyboard is a different layout state, not a variation of the same one —
 * screens use this to decide how much room is genuinely left, rather than
 * trying to preserve a composition that no longer fits.
 *
 * iOS keeps the window at full height and overlays the keyboard, so the value
 * has to be subtracted by hand. Android resizes the window instead, so the
 * viewport height already reflects it and subtracting again would double-count;
 * `insetsViewport` says which is which.
 */
export function useKeyboardHeight(): { height: number; insetsViewport: boolean } {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // `will*` fires with the animation on iOS; Android only has `did*`.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return { height, insetsViewport: Platform.OS === 'ios' };
}
