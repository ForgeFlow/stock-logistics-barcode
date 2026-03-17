import {_t} from "@web/core/l10n/translation";
import {browser} from "@web/core/browser/browser";
import {markup, useRef} from "@odoo/owl";
import {registry} from "@web/core/registry";
import {useBus, useService} from "@web/core/utils/hooks";

const {Component, onWillStart, useEffect} = owl;

export class StockBarcodesMainMenu extends Component {
    static template = "stock_barcodes.MainMenu";

    setup() {
        super.setup();
        this.actionService = useService("action");
        this.ormService = useService("orm");
        const busService = useService("bus_service");
        const notification = useService("notification");
        const barcodeService = useService("barcode");
        this.rootRef = useRef("root");
        this.modelBarcodeAction = "stock.barcodes.action";
        this.homeMenuService = null;
        if (this.hasService("home_menu")) {
            this.homeMenuService = useService("home_menu");
        }
        onWillStart(async () => {
            this.barcodeActions = await this.getBarcodeActions();
        });

        // Listen for barcode scans and send them to the server for lookup.
        // Only process if this component is the visible/active view.
        useBus(barcodeService.bus, "barcode_scanned", ({detail}) => {
            const {barcode} = detail;
            if (barcode && barcode.length >= 3 && this.rootRef.el?.isConnected) {
                this.ormService.call(
                    "wiz.stock.barcodes.read.picking",
                    "process_barcode",
                    [[], barcode]
                );
            }
        });

        // Handle the server response via bus notification.
        const handleActionMainMenuBarcode = (payload) => {
            if (payload.action_ok && payload.action) {
                return this.actionService.doAction(payload.action);
            }
            notification.add(_t("No action found with barcode: " + payload.barcode), {
                type: "danger",
            });
        };
        useEffect(
            () => {
                busService.addChannel("stock_barcodes_main_menu");
                busService.subscribe(
                    "actions_main_menu_barcode",
                    handleActionMainMenuBarcode
                );
                return () => {
                    busService.unsubscribe(
                        "actions_main_menu_barcode",
                        handleActionMainMenuBarcode
                    );
                    busService.deleteChannel("stock_barcodes_main_menu");
                };
            },
            () => []
        );
    }

    hasService(service) {
        return service in this.env.services;
    }

    mainMenuHome() {
        // Enterprise
        if (this.homeMenuService && this.hasService("home_menu")) {
            this.homeMenuService.toggle(true);
        } else {
            // Community
            browser.setTimeout(() => browser.location.reload(), 100);
            return this.actionService.doAction("mail.action_discuss");
        }
    }

    async openAction(action_id) {
        const action = await this.ormService.call(
            this.modelBarcodeAction,
            "open_action",
            [action_id]
        );
        action.help = markup(_t(action.help));
        this.actionService.doAction(action);
    }

    async getBarcodeActions() {
        return await this.ormService.call(this.modelBarcodeAction, "search_read", [], {
            domain: [["action_window_id", "!=", false]],
            fields: ["id", "name", "icon_class"],
        });
    }
}

registry.category("actions").add("stock_barcodes_main_menu", StockBarcodesMainMenu);
