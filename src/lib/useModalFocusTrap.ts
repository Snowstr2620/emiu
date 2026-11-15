import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.hasAttribute('disabled')) return false;
    if (el.closest('[hidden], [aria-hidden="true"]')) return false;
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  });
}

interface UseModalFocusTrapOptions {
  isOpen: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Traps Tab/Shift+Tab focus inside an open modal dialog and restores focus
 * back to the trigger element on close when that trigger is still connected.
 */
export function useModalFocusTrap({
  isOpen,
  containerRef,
  initialFocusRef,
}: UseModalFocusTrapOptions): void {
  useEffect(() => {
    if (!isOpen) return;

    const previousActive =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const container = containerRef.current;
    if (container) {
      const initialTarget = initialFocusRef?.current ?? getFocusableElements(container)[0] ?? container;
      initialTarget.focus({ preventScroll: true });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;

      const focusables = getFocusableElements(root);
      if (focusables.length === 0) {
        event.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const isInside = active instanceof Node && root.contains(active);

      if (event.shiftKey) {
        if (!isInside || active === first || active === root) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (!isInside || active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActive && previousActive.isConnected && typeof previousActive.focus === 'function') {
        previousActive.focus({ preventScroll: true });
      }
    };
  }, [isOpen, containerRef, initialFocusRef]);
}
