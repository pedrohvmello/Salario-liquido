import {
  adjacentMobilePrimaryView,
  MOBILE_SWIPE_EDGE_GUARD_PX,
  MOBILE_SWIPE_INTENT_DOMINANCE_RATIO,
  MOBILE_SWIPE_INTENT_THRESHOLD_PX,
  MOBILE_SYNTHETIC_CLICK_GUARD_MS,
  mobileSwipeProgress,
  mobileSwipeReleaseDuration,
  mobileSwipeShouldComplete,
  mobileSwipeVisualState,
  type MobilePrimaryView,
  type MobileSwipeDirection,
  type MobileSwipeVisualState,
} from "./mobile-primary-navigation";

export type MobileSwipeBlockedReason =
  | "NOT_MOBILE"
  | "OVERLAY_ACTIVE"
  | "EDGE_GESTURE"
  | "HORIZONTAL_GESTURE_CONTROL"
  | "HORIZONTAL_SCROLL_REGION"
  | "VERTICAL_INTENT"
  | "DISTANCE_TOO_SHORT_OR_VERTICAL_DOMINANT"
  | "NO_PREVIOUS_ROUTE"
  | "NO_NEXT_ROUTE"
  | "TOUCH_CANCELLED";

type GestureIntent = "undecided" | "horizontal" | "vertical";

export type MobileSwipeDiagnostic = {
  event:
    | "MOBILE_NAV_SURFACE_MOUNTED"
    | "TOUCH_START_RECEIVED"
    | "TOUCH_MOVE_RECEIVED"
    | "TOUCH_END_RECEIVED"
    | "GESTURE_INTENT_DECIDED"
    | "SWIPE_TRANSITION_STARTED"
    | "SWIPE_TRANSITION_PROGRESSED"
    | "SWIPE_TRANSITION_COMPLETED"
    | "SWIPE_TRANSITION_CANCELLED"
    | "SWIPE_BLOCKED"
    | "SWIPE_NAVIGATED"
    | "SYNTHETIC_CLICK_SUPPRESSED";
  reason?: MobileSwipeBlockedReason;
  intent?: GestureIntent;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  deltaX?: number;
  deltaY?: number;
  currentView: MobilePrimaryView;
  accessibleViews: readonly MobilePrimaryView[];
  destination?: MobilePrimaryView;
  progress?: number;
  velocityX?: number;
};

export type MobileSwipeTransitionFrame = {
  destination: MobilePrimaryView;
  direction: MobileSwipeDirection;
  progress: number;
  visual: MobileSwipeVisualState;
};

export type MobileSwipeTransitionResult = MobileSwipeTransitionFrame & {
  completed: boolean;
  duration: number;
};

type GestureState = {
  identifier: number;
  startX: number;
  startY: number;
  eligible: boolean;
  intent: GestureIntent;
  origin: Element | null;
  direction: MobileSwipeDirection | null;
  destination: MobilePrimaryView | null;
  lastX: number;
  lastTime: number;
  velocityX: number;
  progress: number;
};

const HORIZONTAL_GESTURE_CONTROL_SELECTOR = [
  "input[type='range']",
  "input:not([type='checkbox']):not([type='radio'])",
  "textarea",
  "select",
  ".recharts-wrapper",
  "video",
  "audio",
  "[role='slider']",
  "[data-horizontal-gesture]",
  "[data-swipe-navigation-ignore]",
].join(",");

function elementIsVisible(element: Element, view: Window) {
  if (
    (element as HTMLElement).hidden ||
    element.getAttribute("aria-hidden") === "true"
  )
    return false;
  const style = view.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

export function activeMobileOverlay(document: Document, view: Window) {
  return Array.from(
    document.querySelectorAll(
      '[aria-modal="true"], .payrep-picker-dialog, .sidebar.open, .profile-popover, .mfa-app-picker-overlay, .photo-crop-overlay',
    ),
  ).some((element) => elementIsVisible(element, view));
}

function targetBlockReason(
  target: EventTarget | null,
  boundary: HTMLElement,
  view: Window,
): MobileSwipeBlockedReason | null {
  const viewGlobal = view as Window & typeof globalThis;
  if (!(target instanceof viewGlobal.Element))
    return "HORIZONTAL_GESTURE_CONTROL";
  const targetElement = target as Element;
  const horizontalGestureControl = targetElement.closest(
    HORIZONTAL_GESTURE_CONTROL_SELECTOR,
  );
  if (horizontalGestureControl && boundary.contains(horizontalGestureControl))
    return "HORIZONTAL_GESTURE_CONTROL";

  let element: Element | null = targetElement;
  while (element && element !== boundary) {
    const style = view.getComputedStyle(element);
    if (
      /^(auto|scroll)$/.test(style.overflowX) &&
      element.scrollWidth > element.clientWidth + 1
    )
      return "HORIZONTAL_SCROLL_REGION";
    element = element.parentElement;
  }
  return null;
}

function touchByIdentifier(touches: TouchList, identifier: number) {
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches.item(index);
    if (touch?.identifier === identifier) return touch;
  }
  return null;
}

function blurControlAfterSwipe(
  document: Document,
  origin: Element | null,
  view: Window,
) {
  const viewGlobal = view as Window & typeof globalThis;
  const active = document.activeElement;
  if (active instanceof viewGlobal.HTMLElement && active !== document.body)
    active.blur();
  if (origin instanceof viewGlobal.HTMLElement && origin !== active)
    origin.blur();
}

export function installMobileSwipeNavigation(
  surface: HTMLElement,
  options: {
    getAccessibleViews: () => readonly MobilePrimaryView[];
    getCurrentView: () => MobilePrimaryView;
    isDisabled: () => boolean;
    onNavigate: (view: MobilePrimaryView) => void;
    onDiagnostic?: (diagnostic: MobileSwipeDiagnostic) => void;
    onTransitionStart?: (frame: MobileSwipeTransitionFrame) => void;
    onTransitionProgress?: (frame: MobileSwipeTransitionFrame) => void;
    onTransitionFinish?: (result: MobileSwipeTransitionResult) => void;
  },
) {
  const document = surface.ownerDocument;
  const view = document.defaultView;
  if (!view) return () => undefined;
  const viewGlobal = view as Window & typeof globalThis;
  let gesture: GestureState | null = null;
  let suppressClickUntil = 0;
  let progressFrame = 0;
  let pendingTransitionFrame: MobileSwipeTransitionFrame | null = null;

  const diagnostic = (
    event: MobileSwipeDiagnostic["event"],
    details: Omit<
      MobileSwipeDiagnostic,
      "event" | "currentView" | "accessibleViews"
    > = {},
  ) =>
    options.onDiagnostic?.({
      event,
      currentView: options.getCurrentView(),
      accessibleViews: options.getAccessibleViews(),
      ...details,
    });

  const overlayIsActive = () =>
    options.isDisabled() || activeMobileOverlay(document, view);

  const transitionFrame = (activeGesture: GestureState, deltaX: number) => {
    if (!activeGesture.direction || !activeGesture.destination) return null;
    const progress = mobileSwipeProgress(
      deltaX,
      view.innerWidth,
      activeGesture.direction,
    );
    activeGesture.progress = progress;
    return {
      destination: activeGesture.destination,
      direction: activeGesture.direction,
      progress,
      visual: mobileSwipeVisualState(
        progress,
        view.innerWidth,
        activeGesture.direction,
      ),
    } satisfies MobileSwipeTransitionFrame;
  };

  const flushTransitionProgress = () => {
    if (progressFrame) {
      view.cancelAnimationFrame(progressFrame);
      progressFrame = 0;
    }
    if (!pendingTransitionFrame) return;
    const frame = pendingTransitionFrame;
    pendingTransitionFrame = null;
    options.onTransitionProgress?.(frame);
    diagnostic("SWIPE_TRANSITION_PROGRESSED", {
      destination: frame.destination,
      progress: frame.progress,
    });
  };

  const scheduleTransitionProgress = (frame: MobileSwipeTransitionFrame) => {
    pendingTransitionFrame = frame;
    if (progressFrame) return;
    progressFrame = view.requestAnimationFrame(() => {
      progressFrame = 0;
      flushTransitionProgress();
    });
  };

  const finishTransition = (
    activeGesture: GestureState,
    completed: boolean,
  ) => {
    if (!activeGesture.direction || !activeGesture.destination) return;
    flushTransitionProgress();
    const frame = transitionFrame(
      activeGesture,
      activeGesture.lastX - activeGesture.startX,
    );
    if (!frame) return;
    const result = {
      ...frame,
      completed,
      duration: mobileSwipeReleaseDuration(frame.progress, completed),
    };
    diagnostic(
      completed ? "SWIPE_TRANSITION_COMPLETED" : "SWIPE_TRANSITION_CANCELLED",
      {
        destination: result.destination,
        progress: result.progress,
        velocityX: activeGesture.velocityX,
      },
    );
    if (options.onTransitionFinish) options.onTransitionFinish(result);
    else if (completed) options.onNavigate(result.destination);
  };

  diagnostic("MOBILE_NAV_SURFACE_MOUNTED");

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches.item(0);
    if (!touch || event.touches.length !== 1) {
      if (gesture?.eligible) finishTransition(gesture, false);
      gesture = null;
      return;
    }
    const mobile =
      view.matchMedia?.("(max-width: 760px)").matches ?? view.innerWidth <= 760;
    const edge =
      touch.clientX <= MOBILE_SWIPE_EDGE_GUARD_PX ||
      touch.clientX >= view.innerWidth - MOBILE_SWIPE_EDGE_GUARD_PX;
    const targetReason = targetBlockReason(event.target, surface, view);
    const reason: MobileSwipeBlockedReason | null = !mobile
      ? "NOT_MOBILE"
      : overlayIsActive()
        ? "OVERLAY_ACTIVE"
        : edge
          ? "EDGE_GESTURE"
          : targetReason;

    gesture = {
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      eligible: !reason,
      intent: "undecided",
      origin: event.target instanceof viewGlobal.Element ? event.target : null,
      direction: null,
      destination: null,
      lastX: touch.clientX,
      lastTime: view.performance.now(),
      velocityX: 0,
      progress: 0,
    };
    diagnostic("TOUCH_START_RECEIVED", {
      startX: touch.clientX,
      startY: touch.clientY,
      intent: "undecided",
      ...(reason ? { reason } : {}),
    });
    if (reason) diagnostic("SWIPE_BLOCKED", { reason });
  };

  const onTouchMove = (event: TouchEvent) => {
    const activeGesture = gesture;
    if (!activeGesture || !activeGesture.eligible) return;
    const touch = touchByIdentifier(event.touches, activeGesture.identifier);
    if (!touch) return;
    const deltaX = touch.clientX - activeGesture.startX;
    const deltaY = touch.clientY - activeGesture.startY;
    const moveTime = view.performance.now();
    const elapsed = moveTime - activeGesture.lastTime;
    if (elapsed > 0) {
      const instantaneousVelocity =
        (touch.clientX - activeGesture.lastX) / elapsed;
      activeGesture.velocityX =
        activeGesture.velocityX === 0
          ? instantaneousVelocity
          : activeGesture.velocityX * 0.65 + instantaneousVelocity * 0.35;
    }
    activeGesture.lastX = touch.clientX;
    activeGesture.lastTime = moveTime;

    if (overlayIsActive()) {
      finishTransition(activeGesture, false);
      activeGesture.eligible = false;
      diagnostic("SWIPE_BLOCKED", { reason: "OVERLAY_ACTIVE", deltaX, deltaY });
      return;
    }

    if (activeGesture.intent === "undecided") {
      const horizontalTravel = Math.abs(deltaX);
      const verticalTravel = Math.abs(deltaY);
      if (
        Math.max(horizontalTravel, verticalTravel) <
        MOBILE_SWIPE_INTENT_THRESHOLD_PX
      )
        return;
      if (
        horizontalTravel >
        verticalTravel * MOBILE_SWIPE_INTENT_DOMINANCE_RATIO
      ) {
        activeGesture.intent = "horizontal";
        activeGesture.direction = deltaX < 0 ? "next" : "previous";
        activeGesture.destination = adjacentMobilePrimaryView(
          options.getCurrentView(),
          options.getAccessibleViews(),
          activeGesture.direction,
        );
      } else if (
        verticalTravel >
        horizontalTravel * MOBILE_SWIPE_INTENT_DOMINANCE_RATIO
      )
        activeGesture.intent = "vertical";
      else return;
      diagnostic("GESTURE_INTENT_DECIDED", {
        intent: activeGesture.intent,
        deltaX,
        deltaY,
      });
      if (activeGesture.intent === "horizontal" && !activeGesture.destination) {
        activeGesture.eligible = false;
        diagnostic("SWIPE_BLOCKED", {
          reason:
            activeGesture.direction === "next"
              ? "NO_NEXT_ROUTE"
              : "NO_PREVIOUS_ROUTE",
          deltaX,
          deltaY,
        });
        return;
      }
      if (
        activeGesture.intent === "horizontal" &&
        activeGesture.direction &&
        activeGesture.destination
      ) {
        const frame = transitionFrame(activeGesture, deltaX);
        if (frame) {
          options.onTransitionStart?.(frame);
          diagnostic("SWIPE_TRANSITION_STARTED", {
            destination: frame.destination,
            progress: frame.progress,
          });
        }
      }
    }

    diagnostic("TOUCH_MOVE_RECEIVED", {
      intent: activeGesture.intent,
      deltaX,
      deltaY,
    });
    if (activeGesture.intent === "horizontal") {
      if (event.cancelable) event.preventDefault();
      blurControlAfterSwipe(document, activeGesture.origin, view);
      const frame = transitionFrame(activeGesture, deltaX);
      if (frame) scheduleTransitionProgress(frame);
    }
  };

  const onTouchEnd = (event: TouchEvent) => {
    const activeGesture = gesture;
    gesture = null;
    if (!activeGesture) return;
    const touch = touchByIdentifier(
      event.changedTouches,
      activeGesture.identifier,
    );
    if (!touch) return;
    const deltaX = touch.clientX - activeGesture.startX;
    const deltaY = touch.clientY - activeGesture.startY;
    const endTime = view.performance.now();
    const elapsed = endTime - activeGesture.lastTime;
    if (elapsed > 0) {
      const endVelocity = (touch.clientX - activeGesture.lastX) / elapsed;
      activeGesture.velocityX =
        activeGesture.velocityX === 0
          ? endVelocity
          : activeGesture.velocityX * 0.65 + endVelocity * 0.35;
    }
    activeGesture.lastX = touch.clientX;
    activeGesture.lastTime = endTime;
    diagnostic("TOUCH_END_RECEIVED", {
      startX: activeGesture.startX,
      startY: activeGesture.startY,
      endX: touch.clientX,
      endY: touch.clientY,
      deltaX,
      deltaY,
      intent: activeGesture.intent,
    });
    if (!activeGesture.eligible) return;
    if (overlayIsActive()) {
      finishTransition(activeGesture, false);
      diagnostic("SWIPE_BLOCKED", { reason: "OVERLAY_ACTIVE", deltaX, deltaY });
      return;
    }
    if (activeGesture.intent === "vertical") {
      diagnostic("SWIPE_BLOCKED", {
        reason: "VERTICAL_INTENT",
        deltaX,
        deltaY,
      });
      return;
    }
    if (!activeGesture.direction || !activeGesture.destination) {
      diagnostic("SWIPE_BLOCKED", {
        reason: "DISTANCE_TOO_SHORT_OR_VERTICAL_DOMINANT",
        deltaX,
        deltaY,
      });
      return;
    }
    const frame = transitionFrame(activeGesture, deltaX);
    if (frame) scheduleTransitionProgress(frame);
    const completed = mobileSwipeShouldComplete(
      deltaX,
      deltaY,
      activeGesture.velocityX,
      activeGesture.direction,
    );
    if (!completed) {
      diagnostic("SWIPE_BLOCKED", {
        reason: "DISTANCE_TOO_SHORT_OR_VERTICAL_DOMINANT",
        deltaX,
        deltaY,
      });
      finishTransition(activeGesture, false);
      return;
    }

    if (event.cancelable) event.preventDefault();
    blurControlAfterSwipe(document, activeGesture.origin, view);
    suppressClickUntil =
      view.performance.now() + MOBILE_SYNTHETIC_CLICK_GUARD_MS;
    diagnostic("SWIPE_NAVIGATED", {
      destination: activeGesture.destination,
      deltaX,
      deltaY,
      velocityX: activeGesture.velocityX,
    });
    finishTransition(activeGesture, true);
  };

  const onTouchCancel = () => {
    if (gesture?.eligible) {
      diagnostic("SWIPE_BLOCKED", { reason: "TOUCH_CANCELLED" });
      finishTransition(gesture, false);
    }
    gesture = null;
  };

  const onClickCapture = (event: MouseEvent) => {
    if (
      event.detail === 0 ||
      suppressClickUntil === 0 ||
      view.performance.now() > suppressClickUntil
    )
      return;
    suppressClickUntil = 0;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    diagnostic("SYNTHETIC_CLICK_SUPPRESSED");
  };

  surface.addEventListener("touchstart", onTouchStart, {
    capture: true,
    passive: true,
  });
  surface.addEventListener("touchmove", onTouchMove, {
    capture: true,
    passive: false,
  });
  surface.addEventListener("touchend", onTouchEnd, {
    capture: true,
    passive: false,
  });
  surface.addEventListener("touchcancel", onTouchCancel, {
    capture: true,
    passive: true,
  });
  document.addEventListener("click", onClickCapture, true);
  return () => {
    if (progressFrame) view.cancelAnimationFrame(progressFrame);
    pendingTransitionFrame = null;
    surface.removeEventListener("touchstart", onTouchStart, true);
    surface.removeEventListener("touchmove", onTouchMove, true);
    surface.removeEventListener("touchend", onTouchEnd, true);
    surface.removeEventListener("touchcancel", onTouchCancel, true);
    document.removeEventListener("click", onClickCapture, true);
  };
}
