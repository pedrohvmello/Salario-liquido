"use client";

import {
  createElement,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  mobileSwipeVisualState,
  primaryScrollSnapshot,
  relativeMobilePrimaryDirection,
  resetPrimaryScrollOwners,
  type MobilePrimaryView,
} from "../lib/mobile-primary-navigation";
import {
  installMobileSwipeNavigation,
  type MobileSwipeDiagnostic,
  type MobileSwipeTransitionFrame,
  type MobileSwipeTransitionResult,
} from "../lib/mobile-swipe-controller";

type MobileRoutePreview = Pick<
  MobileSwipeTransitionFrame,
  "destination" | "direction"
>;

const MOBILE_TRANSITION_CLASSES = [
  "mobile-swipe-active",
  "mobile-swipe-dragging",
  "mobile-swipe-completing",
  "mobile-swipe-cancelling",
];

function applyInteractiveVisual(
  surface: HTMLElement,
  frame: MobileSwipeTransitionFrame,
) {
  surface.style.setProperty(
    "--mobile-swipe-outgoing-x",
    `${frame.visual.outgoingX}px`,
  );
  surface.style.setProperty(
    "--mobile-swipe-incoming-x",
    `${frame.visual.incomingX}px`,
  );
  surface.style.setProperty(
    "--mobile-swipe-outgoing-opacity",
    String(frame.visual.outgoingOpacity),
  );
  surface.style.setProperty(
    "--mobile-swipe-incoming-opacity",
    String(frame.visual.incomingOpacity),
  );
  surface.dataset.mobileSwipeProgress = frame.progress.toFixed(3);
}

function clearInteractiveVisual(surface: HTMLElement) {
  surface.classList.remove(...MOBILE_TRANSITION_CLASSES);
  surface.style.removeProperty("--mobile-swipe-outgoing-x");
  surface.style.removeProperty("--mobile-swipe-incoming-x");
  surface.style.removeProperty("--mobile-swipe-outgoing-opacity");
  surface.style.removeProperty("--mobile-swipe-incoming-opacity");
  surface.style.removeProperty("--mobile-swipe-release-duration");
  delete surface.dataset.mobileSwipeProgress;
}

export function PayrepMobileNavigationSurface({
  accessibleViews,
  children,
  currentView,
  disabled,
  navigationKey,
  onNavigate,
  renderView,
  onOpenMenu,
  menuOpen,
}: {
  accessibleViews: readonly MobilePrimaryView[];
  children: ReactNode;
  currentView: MobilePrimaryView;
  disabled: boolean;
  navigationKey: string;
  onNavigate: (view: MobilePrimaryView) => void;
  renderView?: (view: MobilePrimaryView) => ReactNode;
  onOpenMenu: () => void;
  menuOpen: boolean;
}) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const setSurfaceRef = useCallback((surface: HTMLElement | null) => {
    surfaceRef.current = surface;
  }, []);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const setContentRef = useCallback((content: HTMLDivElement | null) => {
    contentRef.current = content;
  }, []);
  const stateRef = useRef({
    accessibleViews,
    currentView,
    disabled,
    onNavigate,
    renderView,
    onOpenMenu,
    menuOpen,
  });
  const previousNavigationKeyRef = useRef<string | null>(null);
  const previousViewRef = useRef(currentView);
  const releaseTimerRef = useRef<number | null>(null);
  const interactiveCommitRef = useRef<MobilePrimaryView | null>(null);
  const [preview, setPreview] = useState<MobileRoutePreview | null>(null);

  useLayoutEffect(() => {
    stateRef.current = {
      accessibleViews,
      currentView,
      disabled,
      onNavigate,
      renderView,
      onOpenMenu,
      menuOpen,
    };
  }, [accessibleViews, currentView, disabled, onNavigate, renderView, onOpenMenu, menuOpen]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const emitDevelopmentDiagnostic =
      import.meta.env.PROD
        ? undefined
        : (detail: MobileSwipeDiagnostic) =>
            surface.dispatchEvent(
              new CustomEvent("payrep:mobile-swipe-diagnostic", { detail }),
            );
    return installMobileSwipeNavigation(surface, {
      getAccessibleViews: () => stateRef.current.accessibleViews,
      getCurrentView: () => stateRef.current.currentView,
      isDisabled: () =>
        stateRef.current.disabled || releaseTimerRef.current !== null,
      onNavigate: (view) => stateRef.current.onNavigate(view),
      onDiagnostic: emitDevelopmentDiagnostic,
      onTransitionStart: (frame) => {
        if (
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          !stateRef.current.renderView
        )
          return;
        if (releaseTimerRef.current !== null) {
          window.clearTimeout(releaseTimerRef.current);
          releaseTimerRef.current = null;
        }
        interactiveCommitRef.current = null;
        clearInteractiveVisual(surface);
        applyInteractiveVisual(surface, frame);
        surface.classList.add("mobile-swipe-active", "mobile-swipe-dragging");
        setPreview({
          destination: frame.destination,
          direction: frame.direction,
        });
      },
      onTransitionProgress: (frame) => {
        if (!surface.classList.contains("mobile-swipe-active")) return;
        applyInteractiveVisual(surface, frame);
      },
      onTransitionFinish: (result: MobileSwipeTransitionResult) => {
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (reducedMotion || !stateRef.current.renderView) {
          clearInteractiveVisual(surface);
          setPreview(null);
          if (result.completed) stateRef.current.onNavigate(result.destination);
          return;
        }
        const targetProgress = result.completed ? 1 : 0;
        surface.classList.remove("mobile-swipe-dragging");
        surface.style.setProperty(
          "--mobile-swipe-release-duration",
          `${result.duration}ms`,
        );
        surface.classList.add(
          result.completed
            ? "mobile-swipe-completing"
            : "mobile-swipe-cancelling",
        );
        void surface.offsetWidth;
        applyInteractiveVisual(surface, {
          ...result,
          progress: targetProgress,
          visual: mobileSwipeVisualState(
            targetProgress,
            window.innerWidth,
            result.direction,
          ),
        });
        releaseTimerRef.current = window.setTimeout(() => {
          releaseTimerRef.current = null;
          if (result.completed) {
            interactiveCommitRef.current = result.destination;
            stateRef.current.onNavigate(result.destination);
          } else {
            clearInteractiveVisual(surface);
            setPreview(null);
          }
        }, result.duration);
      },
    });
  }, []);

  // A gesture starting right beside the left edge is reserved for opening the sidebar.
  // The imported LRP navigation controller excludes this zone from page transitions.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    type EdgeGesture={identifier:number;startX:number;startY:number;eligible:boolean};
    let edge:EdgeGesture|null=null;
    let suppressClickUntil=0;
    const shouldHandle=()=>window.matchMedia("(max-width: 820px)").matches
      &&!stateRef.current.disabled&&!stateRef.current.menuOpen
      &&!document.querySelector('[aria-modal="true"],.profile-popover,.sidebar.open,.payrep-picker-backdrop');
    const touchStart=(event:TouchEvent)=>{
      const touch=event.touches.item(0);
      edge=null;
      if(!touch||event.touches.length!==1||!shouldHandle()||touch.clientX>32)return;
      edge={identifier:touch.identifier,startX:touch.clientX,startY:touch.clientY,eligible:true};
    };
    const touchMove=(event:TouchEvent)=>{
      const g=edge;if(!g||!g.eligible)return;
      const t=Array.from(event.changedTouches).find(x=>x.identifier===g.identifier);
      if(!t)return;
      const dx=t.clientX-g.startX,dy=t.clientY-g.startY;
      if(Math.abs(dy)>16&&Math.abs(dy)>Math.abs(dx)*1.2){g.eligible=false;return;}
      if(dx>18&&dx>Math.abs(dy)*1.25&&event.cancelable)event.preventDefault();
    };
    const touchEnd=(event:TouchEvent)=>{
      const g=edge;edge=null;if(!g||!g.eligible||!shouldHandle())return;
      const t=Array.from(event.changedTouches).find(x=>x.identifier===g.identifier);
      if(!t)return;
      const dx=t.clientX-g.startX,dy=t.clientY-g.startY;
      if(dx<72||dx<=Math.abs(dy)*1.3)return;
      if(event.cancelable)event.preventDefault();
      suppressClickUntil=window.performance.now()+700;
      stateRef.current.onOpenMenu();
    };
    const clear=()=>{edge=null};
    const clickGuard=(event:MouseEvent)=>{
      if(event.detail===0||window.performance.now()>suppressClickUntil)return;
      suppressClickUntil=0;event.preventDefault();event.stopImmediatePropagation();
    };
    surface.addEventListener('touchstart',touchStart,{passive:true,capture:true});
    surface.addEventListener('touchmove',touchMove,{passive:false,capture:true});
    surface.addEventListener('touchend',touchEnd,{passive:false,capture:true});
    surface.addEventListener('touchcancel',clear,{passive:true,capture:true});
    document.addEventListener('click',clickGuard,true);
    return ()=>{
      surface.removeEventListener('touchstart',touchStart,true);
      surface.removeEventListener('touchmove',touchMove,true);
      surface.removeEventListener('touchend',touchEnd,true);
      surface.removeEventListener('touchcancel',clear,true);
      document.removeEventListener('click',clickGuard,true);
    };
  }, []);

  useEffect(
    () => () => {
      if (releaseTimerRef.current !== null)
        window.clearTimeout(releaseTimerRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || previousNavigationKeyRef.current === navigationKey) return;
    const content = contentRef.current;
    const previousNavigationKey = previousNavigationKeyRef.current;
    const previousView = previousViewRef.current;
    const interactiveRouteCommit =
      interactiveCommitRef.current === stateRef.current.currentView;
    interactiveCommitRef.current = null;
    previousNavigationKeyRef.current = navigationKey;
    previousViewRef.current = stateRef.current.currentView;
    const emitRouteDiagnostic = (
      event: string,
      details: Record<string, unknown> = {},
    ) => {
      if (!import.meta.env.PROD)
        surface.dispatchEvent(
          new CustomEvent("payrep:mobile-navigation-diagnostic", {
            detail: { event, navigationKey, ...details },
          }),
        );
    };
    emitRouteDiagnostic("PRIMARY_ROUTE_CHANGED");
    emitRouteDiagnostic("SCROLL_RESET_REQUESTED", {
      scroll: primaryScrollSnapshot(surface),
    });
    resetPrimaryScrollOwners(surface);
    emitRouteDiagnostic("SCROLL_RESET_EXECUTED", {
      scroll: primaryScrollSnapshot(surface),
    });
    if (interactiveRouteCommit) {
      clearInteractiveVisual(surface);
      setPreview(null);
    }

    const direction = relativeMobilePrimaryDirection(
      previousView,
      stateRef.current.currentView,
      stateRef.current.accessibleViews,
    );
    const mobile = window.matchMedia("(max-width: 820px)").matches;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const animationClass =
      direction === "next"
        ? "mobile-route-enter-forward"
        : direction === "previous"
          ? "mobile-route-enter-backward"
          : null;
    const animationClasses = [
      "mobile-route-enter-forward",
      "mobile-route-enter-backward",
    ];
    content?.classList.remove(...animationClasses);
    if (
      previousNavigationKey !== null &&
      !interactiveRouteCommit &&
      content &&
      mobile &&
      !reducedMotion &&
      animationClass
    ) {
      void content.offsetWidth;
      content.classList.add(animationClass);
      emitRouteDiagnostic("PRIMARY_ROUTE_TRANSITION_STARTED", { direction });
    }

    const frame = window.requestAnimationFrame(() => {
      resetPrimaryScrollOwners(surface);
      emitRouteDiagnostic("SCROLL_RESET_EXECUTED", {
        scroll: primaryScrollSnapshot(surface),
      });
    });
    const clearAnimation = () => content?.classList.remove(...animationClasses);
    content?.addEventListener("animationend", clearAnimation, { once: true });
    return () => {
      window.cancelAnimationFrame(frame);
      content?.removeEventListener("animationend", clearAnimation);
      clearAnimation();
    };
  }, [navigationKey]);

  return createElement(
    "section",
    // React invokes this callback ref after commit; createElement itself does not read it.
    // eslint-disable-next-line react-hooks/refs
    {
      ref: setSurfaceRef,
      className: "payrep-swipe-surface",
      "data-mobile-primary-navigation": "true",
      "data-mobile-swipe-preview": preview?.destination,
    },
    createElement(
      "div",
      // React invokes this callback ref after commit; createElement itself does not read it.
      // eslint-disable-next-line react-hooks/refs
      {
        ref: setContentRef,
        className: "payrep-primary-route-content",
        "data-primary-route": currentView,
      },
      children,
    ),
    preview && renderView
      ? createElement(
          "div",
          {
            key: preview.destination,
            className: "payrep-primary-route-preview",
            "data-preview-route": preview.destination,
            "data-preview-direction": preview.direction,
            "aria-hidden": "true",
            inert: true,
          },
          renderView(preview.destination),
        )
      : null,
  );
}
