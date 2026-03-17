import {BarcodeHandlerField} from "@barcodes/barcode_handler_field";
import {patch} from "@web/core/utils/patch";
import {useService} from "@web/core/utils/hooks";
const {useEffect} = owl;

patch(BarcodeHandlerField.prototype, {
    setup() {
        super.setup(...arguments);
        const busService = useService("bus_service");
        this.orm = useService("orm");
        const handleStockBarcodesRefreshData = async () => {
            const model = this.env?.model || this.props?.record?.model;
            const rootModel = model?.root || this.env?.model?.root;
            if (rootModel?.load) {
                await rootModel.load();
            }
            if (model?.notify) {
                model.notify();
            }
        };
        useEffect(
            () => {
                busService.addChannel("barcode_reload");
                busService.subscribe(
                    "stock_barcodes_refresh_data",
                    handleStockBarcodesRefreshData
                );
                return () => {
                    busService.unsubscribe(
                        "stock_barcodes_refresh_data",
                        handleStockBarcodesRefreshData
                    );
                    busService.deleteChannel("barcode_reload");
                };
            },
            () => []
        );
    },
    onBarcodeScanned(event) {
        super.onBarcodeScanned(...arguments);
        const resModel = this.props?.record?.resModel || "";
        if (resModel.includes("wiz.stock.barcodes.read")) {
            const btn = document.getElementById("dummy_on_barcode_scanned");
            if (btn instanceof HTMLElement) {
                btn.click();
            }
        }
    },
});
