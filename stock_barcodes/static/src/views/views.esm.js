/* Copyright 2024 Akretion
/* Copyright 2024 Tecnativa
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

import {getVisibleElements, isVisible} from "@web/core/utils/ui";
import {FormController} from "@web/views/form/form_controller";
import {KanbanController} from "@web/views/kanban/kanban_controller";
import {ListController} from "@web/views/list/list_controller";
import {_t} from "@web/core/l10n/translation";
import {isAllowedBarcodeModel} from "../utils/barcodes_models_utils.esm";
import {patch} from "@web/core/utils/patch";
import {useEffect} from "@odoo/owl";
import {useService} from "@web/core/utils/hooks";

let barcodeOverlaysVisible = false;

// This is necessary because the hotkey service does not make its API public for
// some reasons
export function barcodeRemoveHotkeyOverlays() {
    for (const overlay of document.querySelectorAll(".o_barcode_web_hotkey_overlay")) {
        overlay.remove();
    }
    barcodeOverlaysVisible = false;
}

// This is necessary because the hotkey service does not make its API public for
// some reasons
export function barcodeAddHotkeyOverlays(activeElement) {
    for (const el of getVisibleElements(
        activeElement,
        "[data-hotkey]:not(:disabled)"
    )) {
        const hotkey = el.dataset.hotkey;
        const overlay = document.createElement("div");
        overlay.classList.add(
            "o_barcode_web_hotkey_overlay",
            "position-absolute",
            "top-0",
            "bottom-0",
            "start-0",
            "end-0",
            "d-flex",
            "justify-content-center",
            "align-items-center",
            "m-0",
            "bg-black-50",
            "h6"
        );
        const overlayKbd = document.createElement("kbd");
        overlayKbd.className = "small";
        overlayKbd.appendChild(document.createTextNode(hotkey.toUpperCase()));
        overlay.appendChild(overlayKbd);

        let overlayParent = null;
        if (el.tagName.toUpperCase() === "INPUT") {
            // Special case for the search input that has an access key
            // defined. We cannot set the overlay on the input itself,
            // only on its parent.
            overlayParent = el.parentElement;
        } else {
            overlayParent = el;
        }

        if (overlayParent.style.position !== "absolute") {
            overlayParent.style.position = "relative";
        }
        overlayParent.appendChild(overlay);
    }
    barcodeOverlaysVisible = true;
}

function setupView() {
    const actionService = useService("action");
    const uiService = useService("ui");
    const busService = useService("bus_service");
    const notification = useService("notification");

    const handleKeys = async (ev) => {
        if (ev.keyCode === 113) {
            // F2
            const {activeElement} = uiService;

            if (barcodeOverlaysVisible) {
                barcodeRemoveHotkeyOverlays();
            } else {
                barcodeAddHotkeyOverlays(activeElement);
            }
        } else if (ev.keyCode === 120) {
            // F9
            const button = document.querySelector("button[name='action_clean_values']");
            if (isVisible(button)) {
                button.click();
            }
        } else if (ev.keyCode === 123 || ev.keyCode === 115) {
            // F12 or F4
            await actionService.doAction(
                "stock_barcodes.action_stock_barcodes_action_client",
                {
                    name: "Barcode wizard menu",
                    res_model: "wiz.stock.barcodes.read.picking",
                    type: "ir.actions.act_window",
                }
            );
        }
    };

    const handleStockBarcodesSound = (payload) => {
        if (
            this.model.root.resModel === payload.res_model &&
            this.model.root.resId === payload.res_id
        ) {
            const audio = payload.sound === "ko" ? this.sound_ko : this.sound_ok;
            audio.play().catch(() => {});
        }
    };

    const handleStockBarcodesFocus = (payload) => {
        if (
            this.model.root.resModel === payload.res_model &&
            this.model.root.resId === payload.res_id
        ) {
            requestIdleCallback(() => {
                const input = document.querySelector(
                    `[name=${payload.field_name}] input`
                );
                if (input) {
                    input.focus();
                    input.select();
                }
            });
        }
    };

    const handleStockBarcodesNotify = (payload) => {
        if (
            this.model.root.resModel === payload.res_model &&
            this.model.root.resId === payload.res_id
        ) {
            notification.add(payload.message, {
                title: payload.title,
                type: payload.type,
                sticky: payload.sticky,
            });
        }
    };

    const handleStockBarcodesEditManual = (payload) => {
        if (payload.manual_entry) {
            this.env.bus.trigger("enableFormEditBarcode");
        } else {
            this.env.bus.trigger("disableFormEditBarcode");
        }
    };

    const handleActionsBarcode = (payload) => {
        if (payload.valid_picking) {
            notification.add(_t("The transfer has been validated"), {
                type: "success",
            });
        } else if (payload.apply_inventory) {
            actionService.doAction(
                "stock_barcodes.action_stock_barcodes_action_client"
            );
            notification.add(_t("The inventory adjustment has been validated"), {
                type: "success",
            });
        }
    };

    const handleActionsBarcodeNotification = (payload) => {
        notification.add(_t(payload.message), {
            type: payload.message_type,
            sticky: payload.sticky,
        });
    };

    useEffect(() => {
        document.body.addEventListener("keydown", handleKeys);

        this.sound_ok = document.createElement("audio");
        this.sound_ok.setAttribute("src", "/stock_barcodes/static/src/sounds/bell.wav");
        this.sound_ok.setAttribute("preload", "auto");
        document.body.appendChild(this.sound_ok);

        this.sound_ko = document.createElement("audio");
        this.sound_ko.setAttribute(
            "src",
            "/stock_barcodes/static/src/sounds/error.wav"
        );
        this.sound_ko.setAttribute("preload", "auto");
        document.body.appendChild(this.sound_ko);

        busService.addChannel("stock_barcodes_scan");

        const notificationHandlers = {
            stock_barcodes_sound: handleStockBarcodesSound,
            stock_barcodes_focus: handleStockBarcodesFocus,
            stock_barcodes_notify: handleStockBarcodesNotify,
            stock_barcodes_edit_manual: handleStockBarcodesEditManual,
            actions_barcode: handleActionsBarcode,
            actions_barcode_notification: handleActionsBarcodeNotification,
        };

        Object.entries(notificationHandlers).forEach(([busType, handler]) => {
            busService.subscribe(busType, handler);
        });

        return () => {
            this.sound_ok.remove();
            this.sound_ko.remove();
            document.body.removeEventListener("keydown", handleKeys);
            Object.entries(notificationHandlers).forEach(([busType, handler]) => {
                busService.unsubscribe(busType, handler);
            });
            busService.deleteChannel("stock_barcodes_scan");
        };
    });
}

patch(KanbanController.prototype, {
    setup() {
        super.setup(...arguments);
        if (isAllowedBarcodeModel(this.props.resModel)) {
            setupView.call(this);
        }
    },
});

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);
        if (isAllowedBarcodeModel(this.props.resModel)) {
            setupView.call(this);
        }
    },
});

patch(ListController.prototype, {
    setup() {
        super.setup(...arguments);
        if (isAllowedBarcodeModel(this.props.resModel)) {
            setupView.call(this);
        }
    },
});
