export type FieldDefinition = {
    key: string;
    label: string;
    type: string; // TEXT / NUMBER / SECRET / DATE / URL / TEXTAREA
    required: boolean;
    sensitive: boolean;
};

export type Template = {
    id: string;
    name: string;
    brand?: string | null;
    fields: FieldDefinition[];
    createdAt: string;
    updatedAt: string;
};

export type Card = {
    id: string;
    templateId: string;
    displayName?: string | null;
    data: Record<string, string>;
    createdAt?: string;
};

export type Anycard = {
    id: string;
    cardNumber: string;
    serialNumber?: string | null;
    pin?: string | null;
    anycardType: string;
    balance?: string | null;
    needsRedeem: boolean;
    createdAt: string;
    updatedAt: string;
};

export type WalmartGiftCard = {
    id: string;
    cardNumber: string;
    pin: string;
    balance: number;
    createdAt: string;
    updatedAt: string;
};

export type VanillaGiftCard = {
    id: string;
    cardNumber: string;
    ccv?: string | null;
    expiryDate?: string | null;
    serialNumber?: string | null;
    balance?: number | null;
    needsRedeem: boolean;
    createdAt: string;
    updatedAt: string;
};

export type AutomationTask = {
    id: string;
    type: string;
    status: string;
    data: any;
    result: any;
    lastError?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type BarcodeDecodeResponse = {
    rawText?: string | null;
    serialNumber?: string | null;
    usedOpenCv?: boolean;
    attempts?: number;
    tried?: string[];
    error?: string | null;
};
