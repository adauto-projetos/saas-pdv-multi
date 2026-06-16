/**
 * Abstração do driver de impressora térmica USB (0007F).
 *
 * `PrinterDriver` — interface; permite trocar o driver real pelo Noop em testes.
 * `NoopPrinterDriver` — implementação silenciosa; usada em testes unitários.
 * `UsbPrinterDriver` — lê `PRINTER_DEVICE` e envia ao hardware via escpos.
 *
 * // Install escpos + @escpos/usb to enable USB printing. See RN07 in about.md.
 */

export type KitchenSlipData = {
  orderNum: number;
  comandaLabel: string;
  items: {
    name: string;
    quantity: number;
    unit: string;
    observation: string | null;
  }[];
};

export type ReceiptData = {
  tenantName: string;
  saleId: string;
  items: {
    name: string;
    quantity: number;
    unit: string;
    unitPriceCents: number;
    subtotalCents: number;
  }[];
  totalCents: number;
  paymentMethod: string;
  customerName?: string;
  createdAt: string | Date;
};

export interface PrinterDriver {
  printKitchenSlip(data: KitchenSlipData): Promise<void>;
  printReceipt(data: ReceiptData): Promise<void>;
}

/**
 * Driver silencioso para testes unitários — não acessa hardware nem variáveis
 * de ambiente. Implementa a interface sem efeitos colaterais.
 */
export class NoopPrinterDriver implements PrinterDriver {
  async printKitchenSlip(data: KitchenSlipData): Promise<void> {
    void data; // no-op for tests
  }
  async printReceipt(data: ReceiptData): Promise<void> {
    void data; // no-op for tests
  }
}

/**
 * Driver USB real via escpos. Lê `PRINTER_DEVICE` do ambiente (RN06).
 *
 * Stub — lança erro descritivo pedindo para instalar as dependências nativas.
 * A integração real requer `npm install escpos @escpos/usb` (acesso nativo USB,
 * incompatível com Vercel serverless — RN07).
 */
export class UsbPrinterDriver implements PrinterDriver {
  private readonly device: string | undefined;

  constructor() {
    this.device = process.env.PRINTER_DEVICE;
  }

  async printKitchenSlip(data: KitchenSlipData): Promise<void> {
    void data;
    if (!this.device) {
      throw new Error("PRINTER_DEVICE not configured");
    }
    throw new Error(
      "escpos USB driver not yet installed — run: npm install escpos @escpos/usb",
    );
  }

  async printReceipt(data: ReceiptData): Promise<void> {
    void data;
    if (!this.device) {
      throw new Error("PRINTER_DEVICE not configured");
    }
    throw new Error(
      "escpos USB driver not yet installed — run: npm install escpos @escpos/usb",
    );
  }
}
