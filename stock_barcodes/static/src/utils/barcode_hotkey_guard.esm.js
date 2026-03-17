/**
 * Guard against Node.contains errors in the hotkey service.
 *
 * Barcode scanner browser extensions (e.g. "Odoo Barcode") dispatch synthetic
 * keyboard events whose event.target may not be recognized as a valid Node by
 * the page's JavaScript context (Firefox X-ray wrappers / content-script
 * isolation). The Odoo hotkey service calls reg.area().contains(target) which
 * throws "Node.contains: Argument 1 does not implement interface Node".
 *
 * Strategy: register a capture-phase keydown listener on window that fires
 * BEFORE the hotkey service's bubbling-phase listener. For Enter/Tab events
 * (barcode terminators), we test whether document.body.contains(target)
 * would throw. If it does, the target is not a valid Node and we stop the
 * event before it reaches the hotkey service.
 */
import {whenReady} from "@odoo/owl";

whenReady(() => {
    window.addEventListener(
        "keydown",
        (ev) => {
            if (ev.key !== "Enter" && ev.key !== "Tab") {
                return;
            }
            try {
                // Probe whether the target is a valid Node argument for
                // contains(). This is the exact call that crashes in the
                // hotkey service dispatch.
                document.body.contains(ev.target);
            } catch {
                // Target is not a valid Node (browser extension context).
                // Swallow the event so the hotkey service never sees it.
                ev.stopImmediatePropagation();
                ev.preventDefault();
            }
        },
        true // Capture phase — fires before any bubbling-phase handler
    );
});
