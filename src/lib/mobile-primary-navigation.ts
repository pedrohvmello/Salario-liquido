export const MOBILE_SWIPE_THRESHOLD_PX = 60;
export const MOBILE_SWIPE_DOMINANCE_RATIO = 1.3;
export const MOBILE_SWIPE_INTENT_THRESHOLD_PX = 12;
export const MOBILE_SWIPE_INTENT_DOMINANCE_RATIO = 1.15;
export const MOBILE_SWIPE_EDGE_GUARD_PX = 32;
export const MOBILE_SYNTHETIC_CLICK_GUARD_MS = 700;
export const MOBILE_SWIPE_FLICK_MIN_DISTANCE_PX = 48;
export const MOBILE_SWIPE_FLICK_VELOCITY_PX_PER_MS = 0.55;
export const MOBILE_SWIPE_OUTGOING_TRAVEL_RATIO = 0.32;
export const MOBILE_SWIPE_INCOMING_TRAVEL_RATIO = 0.28;

export type MobilePrimaryView =
 | "overview"
 | "history"
 | "hours"
 | "events"
 | "analytics"
 | "income-tax"
 | "imports"
 | "definitions"
 | "admin"
 | "admin-settings";

export type MobileSwipeDirection = "next" | "previous";

export type MobileSwipeVisualState = {
  incomingOpacity: number;
  incomingX: number;
  outgoingOpacity: number;
  outgoingX: number;
  progress: number;
};

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

function alignedMobileSwipeDistance(
  deltaX: number,
  direction: MobileSwipeDirection,
) {
  return direction === "next" ? -deltaX : deltaX;
}

export function mobileSwipeProgress(
  deltaX: number,
  viewportWidth: number,
  direction: MobileSwipeDirection,
) {
  const visualTravel = Math.min(190, Math.max(140, viewportWidth * 0.42));
  const alignedDistance = alignedMobileSwipeDistance(deltaX, direction);
  return clampUnit(
    (alignedDistance - MOBILE_SWIPE_INTENT_THRESHOLD_PX) /
      (visualTravel - MOBILE_SWIPE_INTENT_THRESHOLD_PX),
  );
}

export function mobileSwipeVisualState(
  progress: number,
  viewportWidth: number,
  direction: MobileSwipeDirection,
): MobileSwipeVisualState {
  const normalizedProgress = clampUnit(progress);
  const directionSign = direction === "next" ? -1 : 1;
  return {
    progress: normalizedProgress,
    outgoingX:
      directionSign *
      viewportWidth *
      MOBILE_SWIPE_OUTGOING_TRAVEL_RATIO *
      normalizedProgress,
    outgoingOpacity: 1 - 0.72 * normalizedProgress,
    incomingX:
      -directionSign *
      viewportWidth *
      MOBILE_SWIPE_INCOMING_TRAVEL_RATIO *
      (1 - normalizedProgress),
    incomingOpacity: 0.08 + 0.92 * normalizedProgress,
  };
}

export function mobileSwipeShouldComplete(
  deltaX: number,
  deltaY: number,
  velocityX: number,
  direction: MobileSwipeDirection,
) {
  const alignedDistance = alignedMobileSwipeDistance(deltaX, direction);
  const alignedVelocity = alignedMobileSwipeDistance(velocityX, direction);
  if (
    alignedDistance <= 0 ||
    Math.abs(deltaX) <= Math.abs(deltaY) * MOBILE_SWIPE_DOMINANCE_RATIO
  )
    return false;
  return (
    alignedDistance >= MOBILE_SWIPE_THRESHOLD_PX ||
    (alignedDistance >= MOBILE_SWIPE_FLICK_MIN_DISTANCE_PX &&
      alignedVelocity >= MOBILE_SWIPE_FLICK_VELOCITY_PX_PER_MS)
  );
}

export function mobileSwipeReleaseDuration(
  progress: number,
  completing: boolean,
) {
  const normalizedProgress = clampUnit(progress);
  return Math.round(
    completing
      ? 120 + (1 - normalizedProgress) * 80
      : 120 + normalizedProgress * 60,
  );
}

export function mobileSwipeDirection(
  deltaX: number,
  deltaY: number,
  threshold = MOBILE_SWIPE_THRESHOLD_PX,
): MobileSwipeDirection | null {
  const horizontalTravel = Math.abs(deltaX);
  const verticalTravel = Math.abs(deltaY);
  if (
    horizontalTravel < threshold ||
    horizontalTravel <= verticalTravel * MOBILE_SWIPE_DOMINANCE_RATIO
  )
    return null;
  return deltaX < 0 ? "next" : "previous";
}

export function adjacentMobilePrimaryView(
  currentView: MobilePrimaryView,
  accessibleViews: readonly MobilePrimaryView[],
  direction: MobileSwipeDirection,
): MobilePrimaryView | null {
  const currentIndex = accessibleViews.indexOf(currentView);
  if (currentIndex < 0) return null;
  const destinationIndex = currentIndex + (direction === "next" ? 1 : -1);
  return accessibleViews[destinationIndex] ?? null;
}

export function relativeMobilePrimaryDirection(
  previousView: MobilePrimaryView,
  nextView: MobilePrimaryView,
  accessibleViews: readonly MobilePrimaryView[],
): MobileSwipeDirection | null {
  const previousIndex = accessibleViews.indexOf(previousView);
  const nextIndex = accessibleViews.indexOf(nextView);
  if (previousIndex < 0 || nextIndex < 0 || previousIndex === nextIndex)
    return null;
  return nextIndex > previousIndex ? "next" : "previous";
}

function resetElementScrollInstantly(element: HTMLElement) {
  const previousBehavior = element.style.scrollBehavior;
  element.style.scrollBehavior = "auto";
  element.scrollTop = 0;
  element.scrollLeft = 0;
  if (previousBehavior) element.style.scrollBehavior = previousBehavior;
  else element.style.removeProperty("scroll-behavior");
}

export function primaryScrollSnapshot(surface: HTMLElement) {
  const document = surface.ownerDocument;
  const view = document.defaultView;
  return {
    windowScrollY: view?.scrollY ?? 0,
    documentElementScrollTop: document.documentElement.scrollTop,
    bodyScrollTop: document.body.scrollTop,
    surfaceScrollTop: surface.scrollTop,
    surfaceOverflowY: view?.getComputedStyle(surface).overflowY ?? "",
  };
}

export function resetPrimaryScrollOwners(surface: HTMLElement) {
  resetElementScrollInstantly(surface);

  const document = surface.ownerDocument;
  const view = document.defaultView;
  let ancestor = surface.parentElement;
  while (ancestor && view) {
    const style = view.getComputedStyle(ancestor);
    if (/^(auto|scroll|overlay)$/.test(style.overflowY))
      resetElementScrollInstantly(ancestor);
    ancestor = ancestor.parentElement;
  }

  const scrollingElement = document.scrollingElement;
  const viewGlobal = view as (Window & typeof globalThis) | null;
  if (viewGlobal && scrollingElement instanceof viewGlobal.HTMLElement)
    resetElementScrollInstantly(scrollingElement);
  resetElementScrollInstantly(document.documentElement);
  resetElementScrollInstantly(document.body);
}
